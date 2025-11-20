import React from 'react';
import { Helmet } from 'react-helmet-async';

interface SEOHeadProps {
  title?: string;
  description?: string;
  keywords?: string[];
  image?: string;
  url?: string;
  type?: 'website' | 'article';
  publishedTime?: string;
  modifiedTime?: string;
  author?: string;
  section?: string;
  tags?: string[];
}

const SEOHead: React.FC<SEOHeadProps> = ({
  title = 'PharmacyCopilot Patient Portal',
  description = 'Access your pharmacy services online. Book appointments, manage prescriptions, communicate with your pharmacist, and take control of your health journey.',
  keywords = ['pharmacy', 'healthcare', 'patient portal', 'prescriptions', 'health'],
  image = '/images/og-default.jpg',
  url = window.location.href,
  type = 'website',
  publishedTime,
  modifiedTime,
  author,
  section,
  tags = [],
}) => {
  const siteName = 'PharmacyCopilot Patient Portal';
  const fullTitle = title.includes(siteName) ? title : `${title} | ${siteName}`;
  const keywordsString = [...keywords, ...tags].join(', ');

  return (
    <Helmet>
      {/* Basic Meta Tags */}
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta name="keywords" content={keywordsString} />
      <meta name="author" content={author || siteName} />
      
      {/* Open Graph Meta Tags */}
      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:image" content={image} />
      <meta property="og:url" content={url} />
      <meta property="og:type" content={type} />
      <meta property="og:site_name" content={siteName} />
      
      {/* Article-specific Open Graph tags */}
      {type === 'article' && publishedTime && (
        <meta property="article:published_time" content={publishedTime} />
      )}
      {type === 'article' && modifiedTime && (
        <meta property="article:modified_time" content={modifiedTime} />
      )}
      {type === 'article' && author && (
        <meta property="article:author" content={author} />
      )}
      {type === 'article' && section && (
        <meta property="article:section" content={section} />
      )}
      {type === 'article' && tags.map((tag, index) => (
        <meta key={index} property="article:tag" content={tag} />
      ))}
      
      {/* Twitter Card Meta Tags */}
      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={image} />
      
      {/* Additional SEO Meta Tags */}
      <meta name="robots" content="index, follow" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <meta httpEquiv="Content-Type" content="text/html; charset=utf-8" />
      <meta name="language" content="English" />
      
      {/* Canonical URL */}
      <link rel="canonical" href={url} />
      
      {/* JSON-LD Structured Data */}
      <script type="application/ld+json">
        {JSON.stringify({
          "@context": "https://schema.org",
          "@type": type === 'article' ? 'Article' : 'WebPage',
          "headline": title,
          "description": description,
          "image": image,
          "url": url,
          ...(type === 'article' && {
            "author": {
              "@type": "Person",
              "name": author || "PharmaCare Team"
            },
            "publisher": {
              "@type": "Organization",
              "name": siteName,
              "logo": {
                "@type": "ImageObject",
                "url": "/images/logo.png"
              }
            },
            "datePublished": publishedTime,
            "dateModified": modifiedTime || publishedTime,
            "mainEntityOfPage": {
              "@type": "WebPage",
              "@id": url
            }
          })
        })}
      </script>
    </Helmet>
  );
};

export default SEOHead;