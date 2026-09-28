const app = require('./app');
const { PORT } = require('./config/env.config');
const { connectDB } = require('./config/database');

connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Servidor escuchando en http://localhost:${PORT}`);
  });
});
