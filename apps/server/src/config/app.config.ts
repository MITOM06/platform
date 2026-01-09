export default () => ({
  port: parseInt(process.env.PORT || '4000', 10),
  jwt: {
    secret: process.env.JWT_SECRET || 'changeme',
    expiresIn: process.env.JWT_EXPIRES || '15m',
    refreshExpiresIn: process.env.REFRESH_EXPIRES || '7d'
  },
  uploadDir: process.env.UPLOAD_DIR || '/tmp/uploads'
});
