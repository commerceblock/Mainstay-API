import React from 'react';
import ReactDOM from 'react-dom';
import Root from './view/Root';
import 'bootstrap/dist/css/bootstrap.min.css';
import '../assets/stylesheets/styles.scss';

ReactDOM.render(<Root />, document.getElementById('root'));

module.hot.accept();
