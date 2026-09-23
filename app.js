const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;
const COLOR = process.env.APP_COLOR || 'BLUE';

app.get('/', (req, res) => {
  res.send(`<h1>Welcome to the ${COLOR} Environment</h1>`);
});

app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

app.listen(PORT, () => {
  console.log(`Application running on port ${PORT} [Environment: ${COLOR}]`);
});