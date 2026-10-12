const usersRepository = require('../repositories/users.repository');
const { userDTO } = require('../dto/user.dto');
const { HttpError } = require('../utils/errors');

class SessionsService {
  async getPublicUser(id) {
    const user = await usersRepository.findById(id);
    if (!user) {
      throw new HttpError(401, 'No autenticado');
    }

    return userDTO(user);
  }
}

module.exports = new SessionsService();