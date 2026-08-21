import searchAdminData from "../models/adminSearchModel.js";

const PAGE_INDEX = [
    { title: "Dashboard", description: "Admin overview and statistics", url: "/dashboard", icon: "layout-dashboard", keywords: "home overview analytics stats" },
    { title: "Current Affairs", description: "Manage courses, PDFs, ads and offers", url: "/current-affairs", icon: "newspaper", keywords: "course pdf document notification advertisement" },
    { title: "New Current Affairs Course", description: "Create a current-affairs course", url: "/current-affairs/new", icon: "plus-circle", keywords: "add create course" },
    { title: "Orders & Refunds", description: "Find payments, customers and refunds", url: "/orders", icon: "receipt-text", keywords: "payment cashfree customer purchase refund" },
    { title: "Cashfree Settings", description: "Configure the payment gateway", url: "/payment-settings", icon: "credit-card", keywords: "payment gateway API sandbox production" },
    { title: "OTP Settings", description: "View 2Factor OTP configuration", url: "/auth-settings", icon: "shield-check", keywords: "2factor sms login authentication" },
    { title: "Social Media", description: "Configure YouTube, Instagram, Facebook and X", url: "/social-media-settings", icon: "share-2", keywords: "youtube instagram facebook twitter x links" }
];

const matches = (page, query) => `${page.title} ${page.description} ${page.keywords}`.toLowerCase().includes(query);

const adminSearch = async (req, res) => {
    try {
        const query = String(req.query.q || "").trim().slice(0, 80);
        const normalized = query.toLowerCase();
        const pages = [
            ...PAGE_INDEX,
            ...(req.admin?.role === "SUPER_ADMIN" ? [{
                title: "Administrators", description: "Manage administrator accounts", url: "/admins",
                icon: "user-cog", keywords: "admin super admin users staff"
            }] : [])
        ].filter((page) => !normalized || matches(page, normalized)).map(({ keywords: _keywords, ...page }) => ({
            ...page, type: "PAGE"
        }));

        if (query.length < 2) {
            return res.json({ success: true, query, results: pages.slice(0, 8) });
        }

        const data = await searchAdminData(query, { includeAdmins: req.admin?.role === "SUPER_ADMIN" });
        const results = [
            ...pages,
            ...data.courses.map((course) => ({
                type: "COURSE", icon: "newspaper", title: course.course_name,
                description: `Current Affairs · ${course.status.replaceAll("_", " ")}`,
                url: `/current-affairs/${course.id}/edit`
            })),
            ...data.documents.map((document) => ({
                type: "DOCUMENT", icon: "file-text", title: document.document_name || "Unnamed PDF",
                description: `${document.course_name} · ${document.document_type.replaceAll("_", " ")}`,
                url: `/current-affairs/${document.course_id}/edit`
            })),
            ...data.orders.map((order) => ({
                type: "ORDER", icon: "receipt-text", title: order.item_name,
                description: `${order.merchant_order_id} · ${order.customer_name} · ${order.status.replaceAll("_", " ")}`,
                url: `/orders#order-${order.id}`
            })),
            ...data.socialAccounts.map((account) => ({
                type: "SOCIAL", icon: "share-2", title: account.label || account.platform,
                description: `${account.platform} · ${account.is_active ? "ACTIVE" : "INACTIVE"}`,
                url: "/social-media-settings"
            })),
            ...data.admins.map((admin) => ({
                type: "ADMIN", icon: "user-cog", title: admin.name,
                description: `${admin.phone_number} · ${admin.role.replaceAll("_", " ")}`,
                url: `/admins#admin-${admin.id}`
            }))
        ];

        return res.json({ success: true, query, results: results.slice(0, 20) });
    } catch (error) {
        console.error("Admin global search error:", error);
        return res.status(500).json({ success: false, message: "Unable to search the admin panel" });
    }
};

export default adminSearch;
