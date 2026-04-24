const express = require('express');
const router = express.Router();
const { getManagedGradeClasses } = require('../controllers/managerController');
const auth = require('../middleware/auth');

router.get('/classes', auth, getManagedGradeClasses);

module.exports = router;
