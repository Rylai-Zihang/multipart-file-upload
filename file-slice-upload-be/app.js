const Koa = require('koa')
const koaBody = require('koa-body')
const Router = require('koa-router')
const fs = require("fs")
const path = require("path")
const cors = require('@koa/cors')
const rimraf = require("rimraf")

const UPLOAD_DIR = path.resolve(__dirname, "..", "target")
const TMP_DIR = path.resolve(__dirname, "..", "tmp")

const app = new Koa()
const router = new Router()

app.use(koaBody({ multipart: true }))
app.use(cors())

// 原生：处理post请求
// const resolvePost = req => {
//     return new Promise(resolve => {
//         let chunk = ""
//         // readable stream
//         req.on("data", data => {
//             chunk += data
//         })
//         req.on("end", () => {
//             resolve(JSON.parse(chunk))
//         })
//     })
// }

// 从指定文件夹读取流数据
const pipeStream = (path, writeStream) => {
    return new Promise(resolve => {
        const readStream = fs.createReadStream(path)
        readStream.on("end", () => {
            resolve()
        })
        // 将读取到的流数据写入一个文件
        readStream.pipe(writeStream)
    })
}

// 合并文件切片
const mergeFileChunk = async (filePath, filename, size) => {
    const chunkDir = path.resolve(TMP_DIR, filename.split(".")[0])
    let chunkPaths = fs.readdirSync(chunkDir)
    chunkPaths.sort((a, b) => {
        return a.split("-")[1] - b.split("-")[1]
    })
    const requestList = chunkPaths.map((chunkPath, index) => {
        pipeStream(path.resolve(chunkDir, chunkPath),
            // 可读流都会传输到可写流的指定位置
            fs.createWriteStream(filePath, {
                start: index * size,
                end: (index + 1) * size
            })
        )
    })
    // 并行写入
    await Promise.all(requestList)
    // 删除临时存放分片的目录
    rimraf(chunkDir, {
        recursive: true
    }, () => {
        console.log('done')
    })
}

router.get('/test', async ctx => {
    const { res } = ctx
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end('Hello NodeJS')
})

router.post('/upload', async ctx => {
    const { res } = ctx
    const body = ctx.request.body
    const chunk = ctx.request.files.chunk
    const { hash, filename } = body
    const chunkDir = path.resolve(TMP_DIR, filename.split(".")[0])
    console.log({ filename })
    const dirExist = fs.existsSync(chunkDir)
    if(!dirExist) {
        // 需逐层创建  因此原始的target文件夹一定要存在
        fs.mkdirSync(chunkDir)
    }
    const oldPath = chunk.path
    const newPath = `${chunkDir}/${hash}`
    await fs.rename(oldPath, newPath, (err) => {
        if(err) {
            console.error(err)
        }
    })
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end('upload success!')
})

router.post("/merge", async ctx => {
    const { res } = ctx
    const body = ctx.request.body
    console.log({body})
    const { filename, size }  = body
    const filePath = path.resolve(UPLOAD_DIR, `${filename}`)
    await mergeFileChunk(filePath, filename, size)
    res.writeHead(200, { 'Content-Type': 'text/plain' })
    res.end('merge success!')
})

app.use(router.routes())
app.listen(3001)
