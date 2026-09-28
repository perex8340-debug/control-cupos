const usersRepository = require('../repositories/users.repository');

class UsersController {
  // Ruta administrativa: ver todos los usuarios (solo admin).
  // Devuelve datos sin password.
  async listUsers(req, res, next) {
    try {
      const users = await usersRepository.findAll();
      const payload = users.map((user) => ({
        id: user._id.toString(),
        first_name: user.first_name,
        last_name: user.last_name,
        email: user.email,
        role: user.role,
      }));
      res.status(200).json({ status: 'success', payload });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new UsersController();