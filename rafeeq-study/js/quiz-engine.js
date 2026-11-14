export function generateAccurateQuestions(text, count = 5) {
  const sentences = text.split(/[.!?؟؛\n]+/).map(s => s.trim()).filter(s => s.length > 15);
  if (!sentences.length) {
    return [{
      q: "ما هو المفهوم الأساسي الوارد في المستند التعليمي؟",
      options: ["المحتوى الرئيسي للملف", "تفاصيل فرعية جانبية", "ملاحظة عامة", "عنوان إضافي"],
      answer: "المحتوى الرئيسي للملف",
      explanation: "سؤال افتراضي استناداً لمحتوى الملف."
    }];
  }

  const step = Math.max(1, Math.floor(sentences.length / count));
  const selected = [];
  for (let i = 0; i < sentences.length && selected.length < count; i += step) {
    selected.push(sentences[i]);
  }

  const allWords = text.split(/\s+/).filter(w => w.length > 4);
  const distractors = [...new Set(allWords)];

  return selected.map((sent, idx) => {
    const words = sent.split(' ').filter(w => w.length > 4);
    const target = words[Math.floor(words.length / 2)] || words[0];
    const prompt = sent.replace(target, '________');
    let wrong = distractors.filter(w => w !== target).sort(() => Math.random() - 0.5).slice(0, 3);
    while (wrong.length < 3) wrong.push('مصطلح تعليمي');

    return {
      q: `سؤال (${idx + 1}): أكمل الفراغ بدقة:\n"${prompt}"`,
      options: [target, ...wrong].sort(() => Math.random() - 0.5),
      answer: target,
      explanation: `المرجع من النص:\n"${sent}"`
    };
  });
}
