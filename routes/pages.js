const express = require('express');
const router = express.Router();
const { renderHome } = require('../controllers/pageController');

router.get('/', renderHome);

module.exports = router;
