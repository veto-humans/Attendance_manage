const express = require('express');
const router = express.Router();
const { getManagedGradeClasses, syncFirestoreFromSheet, getAllClassesStatus } = require('../controllers/managerController');
const auth = require('../middleware/auth');

router.get('/classes', auth, getManagedGradeClasses);
router.get('/all-classes-status', auth, getAllClassesStatus);
router.post('/sync', auth, syncFirestoreFromSheet);
router.post('/sync-firestore', auth, syncFirestoreFromSheet);

module.exports = router;
