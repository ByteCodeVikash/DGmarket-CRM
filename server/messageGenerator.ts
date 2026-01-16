import type { Lead, Client, FollowUp, Quotation, Invoice } from '@shared/schema';

export type MessageType = 'whatsapp_followup' | 'proposal_followup' | 'payment_reminder' | 'meeting_scheduling';
export type LanguageStyle = 'english' | 'hindi_english_mixed';

interface MessageContext {
  name: string;
  serviceInterest?: string;
  lastFollowUp?: Date | null;
  quotationAmount?: number | null;
  invoiceDue?: Date | null;
  invoiceAmount?: number | null;
  companyName?: string;
}

const templates: Record<MessageType, Record<LanguageStyle, string[]>> = {
  whatsapp_followup: {
    english: [
      `Hi {name}! Hope you're doing well. I wanted to follow up on our previous conversation about {service}. Would you like to discuss this further? Looking forward to hearing from you!`,
      `Hello {name}! Just checking in regarding {service}. I'm here to help with any questions you might have. Let me know a convenient time to connect.`,
      `Dear {name}, I hope this message finds you well! I wanted to reconnect about {service}. Is there anything specific you'd like to explore? Happy to assist!`,
    ],
    hindi_english_mixed: [
      `Hi {name}! Kaise ho aap? Main apni previous baat ko follow up karna chahta/chahti tha regarding {service}. Kya aapko iske baare mein aur discuss karna hai? Reply kijiye please!`,
      `Hello {name} ji! Bas check kar raha/rahi tha ki {service} ke baare mein aapka kya decision hai. Agar koi query ho toh batayiye, help karne mein khushi hogi!`,
      `Namaste {name}! Hope all is well. {service} ke regarding main aapse connect karna chahta/chahti tha. Aapka convenient time bataiye meeting ke liye.`,
    ],
  },
  proposal_followup: {
    english: [
      `Hi {name}! I wanted to follow up on the proposal we shared for {service} worth ₹{amount}. Have you had a chance to review it? I'm happy to address any questions or concerns you might have.`,
      `Hello {name}! Just checking in about the ₹{amount} proposal for {service}. We'd love to move forward together. Please let me know if you need any clarifications.`,
      `Dear {name}, hope you're doing great! Following up on our proposal (₹{amount}) for {service}. Looking forward to your valuable feedback and moving ahead together!`,
    ],
    hindi_english_mixed: [
      `Hi {name} ji! Humne jo {service} ka proposal bheja tha worth ₹{amount}, uspe aapki kya response hai? Koi bhi query ho toh zaroor batayiye!`,
      `Hello {name}! ₹{amount} wale proposal ke baare mein update chahiye tha. {service} ke liye ye best deal hai. Aapka feedback important hai humare liye!`,
      `Namaste {name} ji! Proposal review ho gaya kya? {service} ke liye ₹{amount} ka plan kaisa laga? Any modifications chahiye toh batayiye!`,
    ],
  },
  payment_reminder: {
    english: [
      `Hi {name}! This is a friendly reminder about the pending payment of ₹{amount} due on {dueDate}. Please process it at your earliest convenience. Let me know if you need any assistance.`,
      `Hello {name}! Hope you're doing well. Just a quick reminder - the invoice of ₹{amount} is due on {dueDate}. Kindly arrange the payment. Thanks for your cooperation!`,
      `Dear {name}, gentle reminder about invoice payment of ₹{amount} (Due: {dueDate}). If already paid, please ignore. For any queries, feel free to reach out!`,
    ],
    hindi_english_mixed: [
      `Hi {name} ji! Ye ek friendly reminder hai - ₹{amount} ka payment {dueDate} tak due hai. Please process kar dijiye. Koi issue ho toh bataiye!`,
      `Hello {name}! Invoice reminder - ₹{amount} pending hai, due date {dueDate}. Jaldi se payment kar dijiye please. Thanks for your cooperation!`,
      `Namaste {name} ji! Payment reminder ke liye message kar raha/rahi hun. ₹{amount} due hai {dueDate} tak. Agar already paid hai toh ignore karein!`,
    ],
  },
  meeting_scheduling: {
    english: [
      `Hi {name}! I'd love to schedule a meeting to discuss {service} in detail. When would be a convenient time for you this week? Looking forward to connecting!`,
      `Hello {name}! Let's set up a quick call to go over {service}. Please share your availability and I'll send a calendar invite. Excited to speak with you!`,
      `Dear {name}, hope you're doing great! Would you be available for a brief meeting about {service}? Suggest a few slots and we'll make it work!`,
    ],
    hindi_english_mixed: [
      `Hi {name}! {service} ke baare mein detail mein baat karne ke liye meeting schedule karein? Aapki availability bataiye is week ki!`,
      `Hello {name} ji! Quick call set karein {service} discuss karne ke liye? Apna time bataiye, calendar invite bhej dunga/dungi!`,
      `Namaste {name}! Meeting arrange karna chahte hain {service} ke liye. Kab available ho is hafte? Slots share kijiye please!`,
    ],
  },
};

function getRandomTemplate(type: MessageType, style: LanguageStyle): string {
  const templateList = templates[type][style];
  return templateList[Math.floor(Math.random() * templateList.length)];
}

function formatDate(date: Date | string | null | undefined): string {
  if (!date) return 'TBD';
  const d = new Date(date);
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function formatAmount(amount: number | string | null | undefined): string {
  if (!amount) return '___';
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return num.toLocaleString('en-IN');
}

export function generateMessage(
  type: MessageType,
  context: MessageContext,
  style: LanguageStyle = 'english'
): string {
  let template = getRandomTemplate(type, style);
  
  template = template.replace(/\{name\}/g, context.name || 'there');
  template = template.replace(/\{service\}/g, context.serviceInterest || 'our services');
  template = template.replace(/\{amount\}/g, formatAmount(context.quotationAmount || context.invoiceAmount));
  template = template.replace(/\{dueDate\}/g, formatDate(context.invoiceDue));
  template = template.replace(/\{company\}/g, context.companyName || 'our company');
  
  return template;
}

export function generateWhatsAppLink(phone: string, message: string): string {
  const cleanPhone = phone.replace(/\D/g, '');
  const phoneWithCountry = cleanPhone.startsWith('91') ? cleanPhone : `91${cleanPhone}`;
  return `https://wa.me/${phoneWithCountry}?text=${encodeURIComponent(message)}`;
}
