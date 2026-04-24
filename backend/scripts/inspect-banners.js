require("dotenv").config({ path: __dirname + "/../../.env" });
const mongoose = require("mongoose");
const uri = process.env.MONGO_URI || process.env.MONGODB_URI;
(async () => {
  await mongoose.connect(uri);
  const S = require("../src/models/DesktopHomeSection");
  const docs = await S.find({
    type: { $in: ["banner_2col", "banner_3col", "hero_carousel", "banner_single"] },
  }).lean();
  console.log(
    JSON.stringify(
      docs.map((d) => ({ id: String(d._id), type: d.type, title: d.title, data: d.data })),
      null,
      2
    )
  );
  process.exit(0);
})();
