export const API_BASE_URL =
	process.env.NODE_ENV === "production"
		? "https://subscription-management-6uje.onrender.com/api"
		: "http://localhost:5000/api";
