import { getUserSummary } from "../models/userModel.js";

export const getDashboard = async (req, res) => {
  try {
    const userSummary = await getUserSummary();
    return res.render('layouts/layout', {
      title: 'Dashboard | DNS Admin',
      page: '../dashboard/index',
      userSummary
    });
  } catch (error) {
    console.error("Dashboard error:", error);
    return res.status(500).send("Unable to load dashboard");
  }
};
