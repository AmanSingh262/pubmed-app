const express = require('express');
const router = express.Router();

router.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'Template route is active' });
});

module.exports = router;
