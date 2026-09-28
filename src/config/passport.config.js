const passport = require('passport');
const { Strategy: LocalStrategy } = require('passport-local');
const { Strategy: JwtStrategy, ExtractJwt } = require('passport-jwt');
const usersRepository = require('../repositories/users.repository');
const { createHash, isValidPassword } = require('../utils/hash');
const { generateToken, COOKIE_NAME } = require('../utils/jwt');
const { JWT_SECRET } = require('./env.config');
const { HttpError } = require('../utils/errors');

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD_LENGTH = 6;

const normalizeEmail = (email) => email.trim().toLowerCase();

// ---------------------------------------------------------------------------
// Estrategia: register
// Lógica completa del POST /api/sessions/register dentro de Passport.
// ---------------------------------------------------------------------------
passport.use(
  'register',
  new LocalStrategy(
    {
      usernameField: 'email',
      passwordField: 'password',
      passReqToCallback: true,
    },
    async (req, email, password, done) => {
      try {
        const { first_name, last_name } = req.body;

        if (!first_name || !last_name || !email || !password) {
          return done(new HttpError(400, 'Faltan campos obligatorios'));
        }

        const normalizedEmail = normalizeEmail(email);

        if (!EMAIL_REGEX.test(normalizedEmail)) {
          return done(new HttpError(400, 'El email no tiene un formato válido'));
        }

        if (password.length < MIN_PASSWORD_LENGTH) {
          return done(
            new HttpError(400, 'La contraseña debe tener al menos 6 caracteres')
          );
        }

        const existingUser = await usersRepository.findByEmail(normalizedEmail);
        if (existingUser) {
          return done(new HttpError(409, 'El email ya está registrado'));
        }

        const newUser = await usersRepository.create({
          first_name: first_name.trim(),
          last_name: last_name.trim(),
          email: normalizedEmail,
          password: createHash(password),
        });

        return done(null, newUser);
      } catch (error) {
        return done(error);
      }
    }
  )
);

// ---------------------------------------------------------------------------
// Estrategia: login
// Valida credenciales. El JWT lo genera el controller, no la estrategia.
// ---------------------------------------------------------------------------
passport.use(
  'login',
  new LocalStrategy(
    {
      usernameField: 'email',
      passwordField: 'password',
    },
    async (email, password, done) => {
      try {
        if (!email || !password) {
          return done(new HttpError(400, 'Faltan credenciales'));
        }

        const user = await usersRepository.findByEmail(normalizeEmail(email));

        if (!user || !isValidPassword(password, user.password)) {
          return done(new HttpError(401, 'Credenciales inválidas'));
        }

        return done(null, user);
      } catch (error) {
        return done(error);
      }
    }
  )
);

// ---------------------------------------------------------------------------
// Estrategia: current
// Lee y valida el JWT desde la cookie currentUser y deja el payload en req.user.
// ---------------------------------------------------------------------------
passport.use(
  'current',
  new JwtStrategy(
    {
      secretOrKey: JWT_SECRET,
      jwtFromRequest: ExtractJwt.fromExtractors([
        (req) => req.cookies?.[COOKIE_NAME],
      ]),
    },
    async (payload, done) => {
      try {
        return done(null, payload);
      } catch (error) {
        return done(error);
      }
    }
  )
);

// Para OAuth (Google, GitHub, etc.) en el futuro: registrar nuevas estrategias
// aquí mismo, sin tocar app.js. Por ejemplo:
// passport.use(new GoogleStrategy({...}, verifyCallback));

module.exports = passport;