

export const getDashboard = (req, res) => {
    res.render("dashboard/index", {
        title: "Dashboard"
    });
};