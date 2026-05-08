exports.renderHome = (req, res) => {
  res.render('home', {
    firebaseConfig: {
      apiKey: process.env.FIREBASE_API_KEY || '',
      authDomain: process.env.FIREBASE_AUTH_DOMAIN || '',
      projectId: process.env.FIREBASE_PROJECT_ID || '',
      appId: process.env.FIREBASE_APP_ID || ''
    }
  });
};

exports.renderDashboard = (req, res) => {
  res.render('dashboard');
};

exports.renderManager = (req, res) => {
  res.render('manager');
};

exports.renderTeacher = (req, res) => {
  res.render('teacher');
};

exports.renderSecretary = (req, res) => {
  res.render('secretary');
};
