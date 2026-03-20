function write(level, message, fields = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...fields
  };

  const output = JSON.stringify(entry);

  if (level === "error") {
    console.error(output);
    return;
  }

  console.log(output);
}

function withRequestId(requestId) {
  return {
    info(message, fields = {}) {
      write("info", message, {
        requestId,
        ...fields
      });
    },
    warn(message, fields = {}) {
      write("warn", message, {
        requestId,
        ...fields
      });
    },
    error(message, fields = {}) {
      write("error", message, {
        requestId,
        ...fields
      });
    }
  };
}

module.exports = {
  info(message, fields = {}) {
    write("info", message, fields);
  },
  warn(message, fields = {}) {
    write("warn", message, fields);
  },
  error(message, fields = {}) {
    write("error", message, fields);
  },
  withRequestId
};
