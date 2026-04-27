exports.renderHome = (req, res) => {
  res.render('home', {
    title: '出缺席填報系統',
    description: '歡迎使用出缺席管理系統，請登入後開始填報。'
  });
};
