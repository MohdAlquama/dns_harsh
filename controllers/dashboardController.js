// controllers/dashboardController.js

export const getDashboard = (req, res) => {
  res.render('layouts/layout', {
    title: 'Dashboard | DNS Admin',
    page: '../dashboard/index',
  });
};