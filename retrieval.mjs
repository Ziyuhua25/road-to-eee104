const aliases = {
  移位: "shift",
  异步: "asynchronous",
  同步: "synchronous",
  清零: "clear reset",
  置位: "set preset",
  占空比: "duty cycle",
  频率: "frequency",
  延迟: "delay",
  溢出: "overflow",
  卡诺图: "karnaugh map",
  触发器: "flip flop",
  计数器: "counter",
  译码器: "decoder",
  编码器: "encoder",
  多路选择器: "multiplexer",
  加法器: "adder",
  补码: "complement",
  布尔: "boolean",
  真值表: "truth table",
  进制: "binary decimal hexadecimal",
  寄存器: "register",
  时序: "sequential",
  组合逻辑: "combinational",
  竞争: "race",
  冒险: "hazard",
  锁存器: "latch",
  格雷码: "gray",
  德摩根: "morgan",
  摩根: "morgan",
};
export function tokenize(query) {
  let text = query.toLowerCase().replace(/\bjk\b/g,"j k");
  for (const [zh, en] of Object.entries(aliases))
    if (text.includes(zh)) text += " " + en;
  const english = text.match(/[a-z0-9]+/g) || [];
  return [
    ...new Set(
      english.length ? english : text.match(/[\u4e00-\u9fff]{2}/g) || [],
    ),
  ].filter(
    (t) =>
      ![
        "the",
        "is",
        "a",
        "of",
        "to",
        "what",
        "how",
        "and",
        "in",
        "for",
        "explain",
        "please", "why", "does", "do", "when", "both", "would", "should", "can", "could", "are", "be", "this", "that", "happens", "its", "with", "from", "if", "at", "an",
      ].includes(t),
  );
}
export function retrieve(query, corpus, { lecture, limit = 5, context } = {}) {
  if (
    context &&
    Array.isArray(context.pages) &&
    /这个|这里|这一步|当前|this (formula|step|module)/i.test(query)
  ) {
    return corpus
      .filter(
        (d) =>
          d.lecture === Number(context.lecture) &&
          context.pages.includes(d.page) &&
          d.text,
      )
      .slice(0, limit)
      .map((d) => ({ ...d, contextual: true }));
  }
  const terms = tokenize(query);
  if (!terms.length) return [];
  const docs = corpus.filter(
    (d) => d.text && (!lecture || String(d.lecture) === String(lecture)),
  );
  return docs
    .map((doc) => {
      const body = doc.text.toLowerCase();
      let score = 0,
        matched = 0;
      for (const term of terms) {
        const n = body.split(term).length - 1;
        if (n) {
          score += Math.log(1 + n) * (term.length > 3 ? 2 : 1);
          matched++;
        }
      }
      return {
        ...doc,
        score: score / (1 + doc.text.length / 3500),
        coverage: matched / terms.length,
      };
    })
    .filter((d) => d.score > 1 && d.coverage >= 0.6)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
export function validateCitations(answer, sources) {
  const ids = [...answer.matchAll(/\[S(\d+)\]/g)].map((m) => Number(m[1]));
  return {
    valid: ids.length > 0 && ids.every((i) => i > 0 && i <= sources.length),
    citations: ids,
  };
}
