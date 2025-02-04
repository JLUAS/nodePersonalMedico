const checkRoleAuth = (roles) => async (req, res, next) => {
    try {
        if ([].concat(roles).includes(userData.role)) {
            next()
        } else {
            res.status(409)
            res.send({ error: 'No tienes permisos' })
        }

    } catch (e) {
        console.log(e)
        res.status(409)
        res.send({ error: 'Acceso denegado' })
    }

}

module.exports = checkRoleAuth