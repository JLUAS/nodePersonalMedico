const { check } = require('express-validator');
const { validateResult } = require('../helpers/validateHelper');

const validateCreateUser = [
    check('firstName')
        .exists().withMessage('First name is required') 
        .isLength({ min: 3 }).withMessage('First name must be at least 3 characters long'),
    check('middleName')
        .optional() // Campo opcional
        .isLength({ min: 3 }).withMessage('Middle name must be at least 3 characters long'),
    check('lastName')
        .exists().withMessage('Last name is required')
        .isLength({ min: 3 }).withMessage('Last name must be at least 3 characters long'),
    check('password')
        .exists().withMessage('Password is required')
        .isLength({ min: 8 }).withMessage('Password must be at least 8 characters long'),
    check('authCode')
        .exists().withMessage('Auth code is required')
        .isLength({ min: 8 }).withMessage('Auth code must be at least 8 characters long'),
    check('rol')
        .exists().withMessage('Role is required')
        .isLength({ min: 3 }).withMessage('Role must be at least 3 characters long'),
    check('email')
        .exists().withMessage('Email is required')
        .isEmail().withMessage('Invalid email format'),
    (req, res, next) => {
        validateResult(req, res, next);
    }
];

const validateUserRoleAdmin = (roles) => async (req, res, next) => {
    try {
        const role = req.query.role;

        if ([].concat(roles).includes(role)) {
            return next();
        }


        res.status(403).json({ error: 'No tienes permisos para acceder a este recurso' });
    } catch (e) {
        console.error('Error en validateUserRole:', e);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};

const validateUserRoleUser = (roles) => async (req, res, next) => {
    try {
        const role = req.query.role;

        if ([].concat(roles).includes(role)) {
            return next();
        }

        res.status(403).json({ error: 'No tienes permisos para acceder a este recurso' });
    } catch (e) {
        console.error('Error en validateUserRole:', e);
        res.status(500).json({ error: 'Error interno del servidor' });
    }
};



module.exports = { validateCreateUser, validateUserRoleAdmin, validateUserRoleUser };
