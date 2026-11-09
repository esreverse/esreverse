/**
 * Site-wide content and links. Section copy lives in the section components;
 * lists that are shared or long live here.
 */

export const contactEmail = 'eric@esreverse.com';
export const mailto = `mailto:${contactEmail}`;

export const navItems = [
  { id: 'keyskills', label: 'Key Skills' },
  { id: 'clients', label: 'Clients' },
  { id: 'services', label: 'Services' },
  { id: 'contact', label: 'Contact' },
] as const;

export const behavioralPatternsUrl =
  'https://esreverse.notion.site/Behavioral-Patterns-10af6a7d349a8061a44ce2893762a85f';

export const behavioralPatterns = [
  { title: 'Tension & Closure', text: 'Incompleteness drives resolution-seeking behavior.' },
  { title: 'Cheering', text: 'Encouragement boosts confidence and motivation.' },
  { title: 'Autonomy Bias', text: 'Overestimating one’s control over decisions and outcomes.' },
  { title: 'Endowed Progress Effect', text: 'Motivation from artificial goal advancement.' },
  { title: 'Affect Heuristic', text: 'Decisions driven by immediate emotional response.' },
  { title: 'Salience', text: 'Distinctive elements capture attention.' },
  { title: 'Nudging', text: 'Subtle guidance influences choices without limiting freedom.' },
];

export const socialLinks = [
  { label: 'LinkedIn', href: 'https://www.linkedin.com/in/eric-singhartinger/' },
  { label: 'Figma', href: 'https://www.figma.com/@schmeric' },
  { label: 'Medium', href: 'https://medium.com/@eric.singhartinger' },
  { label: 'VSCO', href: 'https://vsco.co/schm-eric/' },
  { label: 'Instagram', href: 'https://www.instagram.com/schm_eric/' },
];

export const tools = [
  { label: 'Rive', href: 'https://rive.app/' },
  { label: 'Spline', href: 'https://spline.design/download' },
  { label: 'UnicornStudio', href: 'https://www.unicorn.studio/' },
  { label: 'Framer', href: 'https://www.framer.com/' },
  { label: 'Arc & Arc Mobile', href: 'https://arc.net/download' },
  { label: 'Notion', href: 'https://www.notion.so/' },
  { label: 'Raycast', href: 'https://www.raycast.com/' },
  { label: 'Things', href: 'https://culturedcode.com/things/' },
  { label: 'BetterTouchTool', href: 'https://folivora.ai/' },
  { label: 'Caffeine', href: 'https://www.caffeine-app.net/' },
  { label: 'Vivid', href: 'https://www.getvivid.app/' },
  { label: 'Bartender', href: 'https://www.macbartender.com/' },
  { label: 'Tripmode', href: 'https://tripmode.ch/' },
  { label: 'TextSniper', href: 'https://textsniper.app/' },
  { label: 'CleanShot X', href: 'https://cleanshot.com/' },
  { label: 'ScreenBrush', href: 'https://imagestudiopro.com/screenbrush/' },
  { label: 'Endel', href: 'https://endel.io/' },
  { label: 'MeetingBar', href: 'https://meetingbar.app/' },
];
