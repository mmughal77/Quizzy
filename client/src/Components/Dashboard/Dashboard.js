import React, { Component } from 'react';
import { connect } from 'react-redux';
import { clearNotifications } from '../../actions';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.min.css';
import DashboardHeader from './DashboardHeader';

class Dashboard extends Component {
  componentWillReceiveProps(nextProps) {
    const { profileUpdated } = nextProps.success;
    if (profileUpdated) {
      toast.success(profileUpdated);
      return this.props.clearNotifications();
    }
  }

  render() {
    return (
      <div className="container" style={{ padding: '10px' }}>
        <ToastContainer position="top-center" />
        <DashboardHeader user={this.props.user} />
      </div>
    );
  }
}

const mapStateToProps = state => ({
  user: state.auth,
  success: state.notification.success
});

export default connect(mapStateToProps, { clearNotifications })(Dashboard);