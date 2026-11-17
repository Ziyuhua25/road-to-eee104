# Road to EEE104

漫画风格 EEE104 交互式学习平台。课程内容以 `assets/sources/` 实际 PDF 为依据，页码统一为 PDF 页序。作业答案是独立推导解答。

## 本地启动

```sh
cd '/Users/jerryhwa/Desktop/XJTLU/Y2S1/EEE104/platform'
npm install
npm start
```

打开 http://127.0.0.1:8104 。仅监听本机。预加载课程、练习与检索无需模型费用。

如需文档上传解析，建立 Python 环境后指定解释器。

```sh
python3 -m venv .venv
.venv/bin/pip install -r requirements.txt
PYTHON="$PWD/.venv/bin/python" npm start
```

旧版 `.ppt` 需要本机 `soffice`（LibreOffice）转换，或先另存为 PDF / PPTX。扫描 PDF 的正文不会自动 OCR，上传时会标为需要人工核对。PPTX 提取文字与表格单元格，公式及图示仍须查看原件。

## 可选真实模型问答

在终端环境中设置 `LLM_API_KEY`、`LLM_MODEL` 和 `LLM_BASE_URL` 后启动。默认 API 为 OpenAI 兼容 Chat Completions，默认模型为 `gpt-4.1-mini`。Key 仅由服务器环境读取，不能写入前端或 Git。模型使用会由相应服务商计费。

后端执行术语扩展、关键词检索、相关性阈值筛选、上下文传递、引用编号检查、模型逐项核验及一次修正重试。未配置 Key 时仅提供检索结果。当前没有语义向量检索、确定性的逐事实真实性保证或自动公式等价验证。网页会明确显示能力边界。

静态托管版本提供所有预加载学习功能与客户端检索。上传解析、真实模型调用需本地 Node 后端。

## 目录

- `app.js`, `style.css`, `index.html` 前端与本地进度
- `data/lectures.json` 来源化模块、推导、例题
- `data/questions.json` 分级练习与渐进提示
- `data/assignments.json` 原题、原图与完整解答
- `data/corpus.json` 原文逐页索引
- `retrieval.mjs` 浏览器与后端共用检索逻辑
- `server.mjs` 本地 API 与静态服务
- `scripts/` 资料构建及打包工具
- `tests/` 固定回归检查

更新课程内容后执行 `npm test`。以 `scripts/index_documents.py` 重建 PDF 索引。避免将旧年份材料混入当前课程。当前 Lecture 11、12 未导入。

掌握状态要求最近至少四次作答、三个不同题目、至少两天，以及 80% 无提示正确率。完成 Lecture 单独记录。练习、错题与主题存于浏览器 localStorage，设置页支持导出导入。模拟考试的截止时间与答卷也会保存。
