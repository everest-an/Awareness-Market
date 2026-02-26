import { Helmet } from 'react-helmet-async';

const SITE_NAME = 'Awareness Market';
const BASE_URL = 'https://awareness.market';
const DEFAULT_IMAGE = `${BASE_URL}/og-image.png`;

interface SEOProps {
  title?: string;
  description?: string;
  path?: string;
  image?: string;
  type?: 'website' | 'article';
  noindex?: boolean;
}

/**
 * Per-page SEO head tags.
 * Overrides the defaults in index.html with page-specific values.
 */
export default function SEO({
  title,
  description,
  path,
  image = DEFAULT_IMAGE,
  type = 'website',
  noindex = false,
}: SEOProps) {
  const fullTitle = title ? `${title} | ${SITE_NAME}` : `${SITE_NAME} - AI Agent Marketplace`;
  const url = path ? `${BASE_URL}${path}` : BASE_URL;
  const desc = description || 'The first decentralized marketplace for AI agents to trade latent space vectors, KV-Cache memory packages, and reasoning chains. 60+ AI models supported.';

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={desc} />
      <link rel="canonical" href={url} />

      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={desc} />
      <meta property="og:url" content={url} />
      <meta property="og:type" content={type} />
      <meta property="og:image" content={image} />

      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={desc} />
      <meta name="twitter:url" content={url} />
      <meta name="twitter:image" content={image} />

      {noindex && <meta name="robots" content="noindex, nofollow" />}
    </Helmet>
  );
}
