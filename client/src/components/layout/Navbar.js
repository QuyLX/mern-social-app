import React from 'react'
import { Link } from 'react-router-dom'
import { connect } from 'react-redux'
import PropTypes from 'prop-types'
import { logout } from '../../actions/auth'


const Navbar = ({ logout, auth: { isAuthenticated, loading } }) => {
    const authLinks = (
        <ul>
            <li>
                <Link className="hide-sm" to='/profiles'>
                    Developers
                </Link>
            </li>
            <li>
                <Link className="hide-sm" to='/posts'>
                    Community
                </Link>
            </li>
            <li>
                <Link className="hide-sm" to='/dashboard'>
                    <i className="fa fa-user"></i>{' '}
                    Dashboard
                </Link>
            </li>
            <li>
                <Link onClick={logout} to='/login'>
                    <i className="fa fa-sign-out"></i>{' '}
                    <span className="hide-sm">Logout</span>
                </Link>
            </li>
        </ul>
    );

    const guestLinks = (
        <ul>
            <li>
                <Link className="hide-sm" to='/profiles'>
                    Developers
                </Link>
            </li>
            <li>
                <Link to='/register'>
                    Register
                </Link>
            </li>
            <li>
                <Link to='/login'>
                    Login
                </Link>
            </li>

        </ul>
    );

    return (
        <nav className="navbar bg-dark">
            <h1>
                <Link to='/'>
                    <i className="fa fa-code"></i> DevConnector
                </Link>
            </h1>
            {!loading && <>{isAuthenticated ? authLinks : guestLinks}</>}
        </nav>
    )
}

Navbar.propTypes = {
    logout: PropTypes.func.isRequired,
    auth: PropTypes.object.isRequired,
}

const mapStateToProps = state => ({
    auth: state.auth
})

export default connect(mapStateToProps, { logout })(Navbar) 
