export default function handler(req, res) {
  const { bundles, keybundle } = req.query;
  console.log('▶️ Received sBundles:', bundles);
  console.log('▶️ Received keybundle:', keybundle);
  res.status(200).json({ status: 'ok' });
}
