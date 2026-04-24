// Sets req.clientRole based on the client type header or route prefix
// This determines what role the user gets on first registration

const VALID_CLIENTS = {
  app: "user",         // DamnDeal app users
  web: "user",         // Web users
  partner: "partner",  // Partner portal
  admin: "admin",      // Admin panel
  delivery: "delivery",// Delivery boy app
};

function clientType(req, res, next) {
  // Client sends x-client-type header: "app" | "web" | "partner" | "admin"
  const client = (req.headers["x-client-type"] || "app").toLowerCase();
  const role = VALID_CLIENTS[client];

  if (!role) {
    return res.status(400).json({
      success: false,
      message: `Invalid client type. Use: ${Object.keys(VALID_CLIENTS).join(", ")}`,
    });
  }

  req.clientType = client;
  req.clientRole = role;
  next();
}

module.exports = { clientType };
