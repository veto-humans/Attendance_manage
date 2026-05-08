const express = require('express');
const router = express.Router();
const {
  renderHome,
  renderDashboard,
  renderManager,
  renderTeacher,
  renderSecretary
} = require('../controllers/pageController');

router.get('/', renderHome);
router.get('/home', renderHome);
router.get('/dashboard', renderDashboard);
router.get('/manager', renderManager);
router.get('/teacher', renderTeacher);
router.get('/secretary', renderSecretary);

module.exports = router;
