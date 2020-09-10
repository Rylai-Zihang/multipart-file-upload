<template>
    <div class="hello">
        <input type="file" @change="handleFileChange"/>
        <a-button :style="{ 'margin-right': '10px'}" @click="handleUpload">上传</a-button>
        <a-button @click="handleMerge">合并</a-button>
    </div>
</template>

<script>
    const SIZE = 10 * 512 * 512 // 切片大小
    export default {
        name: 'HelloWorld',
        props: {
            msg: String
        },
        data: () => ({
            container: {
                file: null
            },
            data: []
        }),
        methods: {
            // 封装请求对象
            request({
                url,
                method = "post",
                // contentType = "multipart/form-data",
                data,
                headers = {},
                requestList
            }) {
                return new Promise(resolve => {
                    const xhr = new XMLHttpRequest()
                    xhr.open(method, url)
                    Object.keys(headers).forEach(key =>
                        xhr.setRequestHeader(key, headers[key])
                    )
                    // xhr.setRequestHeader("Content-Type", contentType)
                    xhr.send(data)
                    xhr.onload = e => {
                        resolve({
                            data: e.target.response
                        })
                    }
                })
            },
            // 关键1：使用Blob.prototype.slice生成文件Blob切片数组
            createFileChunk(file, size = SIZE) {
                const fileChunkList = []
                let cur = 0
                while(cur < file.size) {
                    fileChunkList.push({ file: file.slice(cur, cur + size)})
                    cur += size
                }
                console.log(fileChunkList)
                return fileChunkList
            },
            async uploadChunks() {
                const filename = this.container.file.name
                const formDataList = this.data.map(({ chunk, hash }, index) => {
                    const formData = new FormData()
                    formData.append("chunk", chunk)
                    formData.append("hash", hash)
                    formData.append("index", index + "")
                    formData.append("filename", filename)
                    // console.log({ chunk, hash })
                    return { formData }
                })
                const requestList = formDataList.map(({ formData }) => {
                    this.request({
                        url: "http://localhost:3001/upload",
                        data: formData
                    })
                })
                // 关键2：使用Promise.all发送全部请求(异步任务并发发送，因此要记录index值)
                await Promise.all(requestList).then(res => {
                    alert("全部上传完成")
                })
            },
            async handleUpload() {
                if(!this.container.file) return
                const fileChunkList = this.createFileChunk(this.container.file)
                this.data = fileChunkList.map((item, index) => {
                    return {
                        chunk: item.file,
                        hash: this.container.file.name + "-" + index
                    }
                })
                await this.uploadChunks()
            },
            handleFileChange(e) {
                const [file] = e.target.files
                if (!file) return
                Object.assign(this.$data, this.$options.data())
                this.container.file = file
            },
            handleMerge() {
                this.request({
                    url: "http://localhost:3001/merge",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    data: JSON.stringify({
                        size: SIZE,
                        filename: this.container.file.name
                    })
                }).then(res => {
                    alert("合并完成")
                })
            }
        }

    }
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>
    h3 {
        margin: 40px 0 0
    }
    ul {
        list-style-type: none;
        padding: 0
    }
    li {
        display: inline-block;
        margin: 0 10px
    }
    a {
        color: #42b983
    }
</style>
