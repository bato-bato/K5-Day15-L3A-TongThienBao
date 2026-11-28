import React, { useState } from 'react';

const methods = [
  { label: 'Lấy nhãn gần nhất', code: 'labels[0]', run: labels => labels[0] },
  { label: 'Bỏ phiếu đa số', code: 'spamCount >= 2 ? "spam" : "ham"',
    run: labels => labels.filter(label => label === 'spam').length >= 2 ? 'spam' : 'ham' },
];
const cases = Array.from({ length: 8 }, (_, mask) =>
  [4, 2, 1].map(bit => mask & bit ? 'ham' : 'spam'));
const example = ['spam', 'spam', 'ham'];
const signature = labels => labels.join('/');

export function Counterexample({ onAskTutor, onOpenConcept }) {
  const [method, setMethod] = useState(0);
  const [labels, setLabels] = useState(null);
  const [search, setSearch] = useState('');
  const [challenge, setChallenge] = useState(null);
  const [guess, setGuess] = useState(null);
  const sample = labels ?? example;
  const selected = methods[method];
  const expected = methods[1].run(sample);

  function findCase() {
    const found = cases.find(input => selected.run(input) !== methods[1].run(input));
    setLabels(found ?? [...example]);
    setSearch(found ? 'Đã tìm thấy một phản ví dụ.' : 'Không thấy phản ví dụ trong 8 cách gán nhãn cho 3 láng giềng.');
    setChallenge(null);
    setGuess(null);
  }
  function nextChallenge() {
    const options = cases.filter(input => ![example, sample, challenge ?? []]
      .some(seen => signature(seen) === signature(input)));
    setChallenge(options[Math.floor(Math.random() * options.length)]);
    setGuess(null);
  }

  return (
    <section className="knn-demo" aria-labelledby="knn-title">
      <h3 id="knn-title">Tìm phản ví dụ cho knn_predict</h3>
      <p>Ba tin nhắn đã xếp từ gần đến xa. Với k = 3, checkpoint yêu cầu bỏ phiếu theo đa số. Cả hai hàm đều qua ca mẫu <code>spam · spam · ham</code>. Chọn một hàm để kiểm tra.</p>
      <fieldset>
        <legend>Hàm cần thử</legend>
        {methods.map((item, i) => <label key={item.label}>
          <input type="radio" name="knn-method" checked={method === i} onChange={() => {
            setMethod(i); setLabels(null); setSearch(''); setChallenge(null); setGuess(null);
          }} /> {item.label} <code>{item.code}</code>
        </label>)}
      </fieldset>
      <button className="knn-primary" onClick={findCase}>Tìm phản ví dụ</button>
      {labels && <>
        <p role="status">{search}</p>
        <div className="knn-neighbors">{labels.map((label, i) => <label key={i}>
          Láng giềng {i + 1}
          <select value={label} onChange={e => {
            setLabels(labels.map((value, n) => n === i ? e.target.value : value));
            setSearch('Đã chạy lại hai hàm trên ca bạn vừa sửa.'); setChallenge(null); setGuess(null);
          }}><option>spam</option><option>ham</option></select>
        </label>)}</div>
        <div className="knn-outputs" aria-live="polite">
          {methods.map(item => <div key={item.label}>{item.label}<strong>{item.run(sample)}</strong></div>)}
        </div>
        <p>{selected.run(sample) === expected ? 'Hàm đã chọn khớp kết quả chuẩn ở ca này.' : 'Hàm đã chọn khác kết quả chuẩn ở ca này.'}</p>
        <div className="knn-actions">
          <button onClick={() => onAskTutor('Ở Day 01 CP2, mình thử knn_predict với k=3. Nhãn từ gần đến xa là ' +
            sample.join(', ') + '. Hàm lấy gần nhất trả ' + methods[0].run(sample) +
            ', hàm đa số trả ' + expected + '. Vì sao? Chỉ ra biểu thức quyết định nhãn và gợi ý một bước tự kiểm.')}>Hỏi gia sư về kết quả</button>
          <button onClick={onOpenConcept}>Mở kNN trên Mindmap</button>
          <button onClick={nextChallenge}>Thử một ca mới</button>
        </div>
        {challenge && <fieldset>
          <legend>Dự đoán trước khi xem kết quả</legend>
          <p>Với {challenge.join(' → ')} từ gần đến xa, hàm bỏ phiếu đa số trả nhãn gì?</p>
          <div className="knn-actions">{['spam', 'ham'].map(value =>
            <button key={value} disabled={guess !== null} onClick={() => setGuess(value)}>{value}</button>)}</div>
          {guess && <p role="status">{guess === methods[1].run(challenge) ? 'Đúng.' : 'Chưa đúng.'} Nhãn {methods[1].run(challenge)} nhận {challenge.filter(x => x === methods[1].run(challenge)).length}/3 phiếu.</p>}
        </fieldset>}
      </>}
    </section>
  );
}
