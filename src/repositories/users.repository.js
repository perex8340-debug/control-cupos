const usersDAO = require('../dao/users.dao');

class UsersRepository {
  async findByEmail(email) {
    return usersDAO.findByEmail(email);
  }

  async findAll() {
    return usersDAO.findAll();
  }

  async findById(id) {
    return usersDAO.findById(id);
  }

  async create(userData) {
    return usersDAO.create(userData);
  }
}

module.exports = new UsersRepository();
