function createSurveyForm() {
  const form = FormApp.create('Học viên dùng AI khi làm lab như thế nào?', false);
  form
    .setDescription('Hãy nghĩ về bài lab AI20K gần nhất bạn đã bắt đầu, kể cả khi chưa làm xong. Trả lời theo những gì bạn thực sự đã làm trong bài đó. Form không thu email hay MSSV.')
    .setCollectEmail(false)
    .setLimitOneResponsePerUser(false)
    .setPublishingSummary(false)
    .setConfirmationMessage('Cảm ơn bạn đã chia sẻ trải nghiệm!');

  console.log('Chỉnh sửa: ' + form.getEditUrl());
  console.log('Link trả lời sau khi xuất bản: ' + form.getPublishedUrl());

  const multipleChoice = (title, options) => {
    const item = form.addMultipleChoiceItem().setTitle(title).setRequired(true);
    if (options) item.setChoiceValues(options);
    return item;
  };

  const checkboxes = (title, options) => form.addCheckboxItem()
    .setTitle(title).setChoiceValues([...options, 'Khác']).setRequired(true);

  const branch = (item, routes) => item.setChoices(
    routes.map(([label, destination]) => item.createChoice(label, destination))
  );

  multipleChoice('Bạn học lớp nào?', ['L3A', 'L3B', 'Lớp khác']);
  const background = multipleChoice('Trước khi vào khóa AI20K, nền tảng chính của bạn là gì?');

  const tech = form.addPageBreakItem().setTitle('Nền tảng kỹ thuật');
  multipleChoice('Nếu có nền tảng tech, bạn từng học hoặc làm trong mảng nào?', [
    'Chủ yếu AI/ML', 'Chủ yếu tech ngoài AI/ML', 'Cả hai',
  ]);

  const lab = form.addPageBreakItem().setTitle('Bài lab gần nhất');
  multipleChoice('Bạn đã làm bài lab gần nhất đến đâu?', [
    'Hoàn thành toàn bộ', 'Làm một phần và dự định làm tiếp',
    'Dừng giữa chừng và chưa có kế hoạch làm tiếp',
  ]);
  multipleChoice('Mục tiêu chính của bạn khi học AI trong khóa này là gì?', [
    'Hiểu sâu cách AI hoạt động và vì sao các phương pháp cho ra kết quả.',
    'Nắm các khái niệm cơ bản để áp dụng AI vào công việc.',
    'Cả hai mục tiêu quan trọng như nhau.',
    'Chưa có mục tiêu rõ ràng.', 'Khác',
  ]);
  const aiUse = multipleChoice('Cách bạn dùng AI trong bài lab đó gần nhất với kiểu nào?');

  const aiDetails = form.addPageBreakItem().setTitle('Cách bạn dùng AI khi làm lab');
  multipleChoice('Bạn hỏi AI lần đầu vào lúc nào?', [
    'Trước khi tự thử', 'Sau khi đã tự thử một phần, lúc đó chưa bị kẹt',
    'Khi gặp lỗi hoặc bị kẹt', 'Sau khi làm xong',
  ]);
  checkboxes('Lần đầu hỏi AI, bạn đưa cho AI những gì?', [
    'Toàn bộ đề lab', 'Một checkpoint hoặc một phần đề', 'Code mình đã viết',
    'Thông báo lỗi hoặc kết quả chạy', 'Câu hỏi về một khái niệm',
  ]);
  checkboxes('Trong bài đó, bạn đã nhờ AI làm những việc gì?', [
    'Giải thích đề hoặc khái niệm', 'Gợi ý bước tiếp theo', 'Viết code hoặc đưa lời giải',
    'Sửa lỗi', 'Kiểm tra kết quả', 'Giải thích lại code hoặc lời giải',
  ]);
  multipleChoice('Khi có code hoặc lời giải từ AI, bạn chủ yếu xử lý thế nào?', [
    'Đọc và kiểm tra trước khi dùng', 'Chạy thử rồi đọc lại', 'Dùng tiếp nếu thấy chạy được',
    'Chỉ lấy gợi ý rồi tự viết', 'Không nhận code hoặc lời giải từ AI',
  ]);
  multipleChoice('Khi có một bước hoặc lời giải của AI mà bạn chưa hiểu, bạn chủ yếu làm gì?', [
    'Hỏi AI giải thích ngay', 'Đợi đến cuối bài rồi hỏi AI giải thích lại',
    'Tự tìm hiểu hoặc hỏi người khác', 'Tiếp tục làm hoặc nộp bài mà chưa tìm hiểu thêm',
    'Không gặp tình huống này',
  ]);
  checkboxes('Bạn đã kiểm tra câu trả lời của AI bằng cách nào?', [
    'Chạy thử với dữ liệu hoặc ví dụ mẫu', 'Thử thêm trường hợp khác',
    'Đối chiếu với yêu cầu hoặc kết quả mẫu của lab', 'Đọc lại và tự kiểm tra từng bước',
    'Hỏi bạn học hoặc coach', 'Không kiểm tra',
  ]).setHelpText('Nếu chọn “Không kiểm tra”, chỉ chọn phương án đó.');
  multipleChoice('Có lần nào câu trả lời của AI khiến bạn phải sửa hoặc làm lại một phần bài không?', [
    'Có, một lần', 'Có, nhiều lần', 'Không', 'Không chắc',
  ]);

  const understanding = form.addPageBreakItem().setTitle('Mức độ hiểu bài và xem lại bài giảng');
  multipleChoice('Trong phần lab đã làm, bạn tự đánh giá mình hiểu khoảng bao nhiêu phần trăm?', [
    '0–24%', '25–49%', '50–74%', '75–99%', '100%', 'Chưa tự đánh giá được',
  ]).setHelpText('“Hiểu” là bạn có thể giải thích mình đã làm gì và vì sao.').setRequired(false);
  multipleChoice('Khi làm bài đó, có bước nào bạn chạy ra kết quả nhưng vẫn chưa hiểu vì sao không?', [
    'Có', 'Không', 'Không chắc', 'Chưa chạy ra kết quả',
  ]);
  multipleChoice('Bạn đã thử tự làm lại một bước chính mà không nhìn lời giải chưa?', [
    'Đã thử và tự làm lại được', 'Đã thử nhưng vẫn cần xem lời giải hoặc hỏi thêm', 'Chưa thử',
  ]);
  multipleChoice('Trong lúc làm lab, có lúc nào bạn thấy cần xem lại lecture hoặc pre-class không?', [
    'Có', 'Không', 'Không nhớ',
  ]);
  multipleChoice('Bạn có thực sự mở lại lecture hoặc pre-class trong lúc làm lab không?', [
    'Có', 'Không', 'Không nhớ',
  ]);
  const support = multipleChoice('Bạn muốn tụi mình hỗ trợ nhóm bạn theo cách nào?');

  const link = form.addPageBreakItem().setTitle('Gửi link của nhóm bạn');
  form.addTextItem()
    .setTitle('Dán link khảo sát hoặc showcase của nhóm bạn.')
    .setHelpText('Tùy chọn. Chỉ dán một đường liên kết.')
    .setValidation(FormApp.createTextValidation().requireTextIsUrl().build());

  branch(background, [
    ['Tech — từng học hoặc làm trong lĩnh vực kỹ thuật như lập trình, dữ liệu, IT', tech],
    ['Non-tech — chủ yếu học hoặc làm ở lĩnh vực khác', lab],
  ]);
  branch(aiUse, [
    ['Đưa cả đề cho AI và nhờ AI làm phần lớn hoặc toàn bộ bài.', aiDetails],
    ['Tự làm theo từng checkpoint và hỏi AI ngay ở bước chưa hiểu hoặc bị kẹt.', aiDetails],
    ['Tự làm một mạch và chỉ hỏi AI khi gặp lỗi hoặc bị kẹt.', aiDetails],
    ['Tự làm phần lớn hoặc toàn bộ bài rồi mới nhờ AI review.', aiDetails],
    ['Không dùng AI cho bài này.', understanding],
    ['Khác', aiDetails],
  ]);
  branch(support, [
    ['Điền khảo sát của nhóm bạn. Mình sẽ nhờ 8 thành viên trong khu tự trị của mình điền.', link],
    ['Góp ý showcase. Mình sẽ xem và để lại feedback.', link],
    ['Mình là Phật, xin bỏ qua phần này 🙏', FormApp.PageNavigationType.SUBMIT],
  ]);
}
