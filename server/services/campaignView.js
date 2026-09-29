// Public discovery uses an explicit field list; private details require identity.
function campaignView(document, user) {
  const campaign = document.toObject ? document.toObject() : document;
  const owner = user && (String(user.id) === String(campaign.companyId)
    || user.email === (process.env.ADMIN_EMAIL || 'admin@spreadfast.com'));
  if (owner) return campaign;
  const fields = ['id', 'title', 'description', 'budget', 'pricing', 'companyId',
    'socialMediaPlatforms', 'keyMessage', 'status', 'statusUpdatedAt', 'createdAt'];
  const view = Object.fromEntries(fields.filter(key => campaign[key] !== undefined).map(key => [key, campaign[key]]));
  const members = campaign.subscribedPromoters || [];
  view.subscribedCount = members.length;
  view.subscribedPromoters = user ? members.filter(member => String(member.promoterId) === String(user.id)) : [];
  // Shared assets remain available to subscribed creators through existing asset routes.
  if (view.subscribedPromoters.length) view.brandAssets = campaign.brandAssets || [];
  return view;
}
module.exports = { campaignView };
