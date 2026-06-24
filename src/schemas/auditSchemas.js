'use strict';

const { z } = require('zod');

const launchAudit = z.object({}).optional();

module.exports = { launchAudit };
