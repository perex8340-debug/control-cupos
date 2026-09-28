const usersRepository = require('../repositories/users.repository');
const { HttpError } = require('../utils/errors');

class SessionsService {
  async getPublicUser(id) {
    const user = await usersRepository.findById(id);
    if (!user) {
      throw new HttpError(401, 'No autenticado');
    }

    return {
      id: user._id.toString(),
      first_name: user.first_name,
      last_name: user.last_name,
      email: user.email,
      role: user.role,
    };
  }
}

module.exports = new SessionsService();