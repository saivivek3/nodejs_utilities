const express = require("express");
const multer = require("multer");
const path = require("path");
const fs = require("fs");
const { createObjectCsvStringifier } = require("csv-writer");

const app = express();

// Ensure the uploads directory exists
const uploadDir = "uploads/";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + "-" + file.originalname);
  },
});

// File filter to only accept JSON files
const fileFilter = (req, file, cb) => {
  const filetypes = /json/;
  const mimetype = filetypes.test(file.mimetype);
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error("Only JSON files are allowed!"));
  }
};

const uploadStorage = multer({
  storage: storage,
  fileFilter: fileFilter,
});

// Single file
app.post("/upload/single", uploadStorage.single("file"), (req, res) => {
  if (req.file) {
    // Read the uploaded JSON file
    fs.readFile(req.file.path, "utf8", (err, data) => {
      if (err) {
        return res.status(500).send("Error reading the JSON file");
      }
      try {
        const jsonData = JSON.parse(data);
        console.log(jsonData);

        // Function to flatten nested JSON
        const flattenObject = (obj, prefix = "") => {
          let flat = {};
          for (let key in obj) {
            if (obj.hasOwnProperty(key)) {
              if (typeof obj[key] === "object" && !Array.isArray(obj[key])) {
                let nestedObject = flattenObject(obj[key], prefix + key + ".");
                for (let nestedKey in nestedObject) {
                  if (nestedObject.hasOwnProperty(nestedKey)) {
                    flat[nestedKey] = nestedObject[nestedKey];
                  }
                }
              } else if (Array.isArray(obj[key])) {
                obj[key].forEach((item, index) => {
                  if (typeof item === "object") {
                    let nestedArrayObject = flattenObject(
                      item,
                      prefix + key + "[" + index + "]."
                    );
                    for (let nestedArrayKey in nestedArrayObject) {
                      if (nestedArrayObject.hasOwnProperty(nestedArrayKey)) {
                        flat[nestedArrayKey] =
                          nestedArrayObject[nestedArrayKey];
                      }
                    }
                  } else {
                    flat[prefix + key + "[" + index + "]"] = item;
                  }
                });
              } else {
                flat[prefix + key] = obj[key];
              }
            }
          }
          return flat;
        };

        // Function to dynamically create CSV stringifier
        const createDynamicCsvStringifier = (data) => {
          const flattenedData = data.map((item) => flattenObject(item));
          const headers = Array.from(
            new Set(flattenedData.flatMap((item) => Object.keys(item)))
          ).map((key) => ({ id: key, title: key }));

          return createObjectCsvStringifier({
            header: headers,
          });
        };

        // Flatten and prepare data for CSV writing
        const flatData = jsonData.map((item) => flattenObject(item));

        // Create CSV stringifier
        const csvStringifier = createDynamicCsvStringifier(flatData);
        const header = csvStringifier.getHeaderString();
        const records = csvStringifier.stringifyRecords(flatData);

        // Set the response headers for file download
        res.setHeader("Content-disposition", "attachment; filename=test.csv");
        res.set("Content-Type", "text/csv");

        // Send the CSV content as the response
        res.send(header + records);
      } catch (err) {
        return res.status(400).send("Error parsing the JSON file");
      }
    });
  } else {
    return res.status(400).send("Error: Only JSON files are allowed!");
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  if (err) {
    return res.status(400).send(err.message);
  }
  next();
});

app.listen(3000 || process.env.PORT, () => {
  console.log("Server on...");
});
