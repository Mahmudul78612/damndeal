// Legal page content - structured data for legal pages
export interface LegalSection {
  heading?: string;
  paragraphs?: string[];
  bullets?: string[];
}

export interface LegalDoc {
  title: string;
  effectiveDate?: string;
  intro?: string[];
  sections: LegalSection[];
  contact?: {
    email?: string;
    phone?: string;
    website?: string;
  };
}

export const LEGAL_DOCS: Record<string, LegalDoc> = {
  privacy: {
    title: 'Data Deletion and Privacy Request Policy',
    effectiveDate: 'April 11, 2025',
    intro: [
      'At DamnDeal, we are committed to protecting your privacy and complying with applicable data protection laws.',
      'This policy outlines how you may request the deletion of your entire account and all associated data, or specific personal data while keeping your account active.',
    ],
    sections: [
      {
        heading: 'Request Full Account Deletion',
        paragraphs: [
          'You may request the permanent deletion of your DamnDeal account and all associated personal information.',
        ],
        bullets: [
          'Email us at info@damndeal.in',
          'Use the subject line: "Full Account Deletion Request – [Your Registered Email ID]"',
          'Include your full name, registered email ID and mobile number',
          'Provide a clear request to delete your entire account and personal data',
        ],
      },
      {
        heading: 'Verification & Processing',
        paragraphs: [
          'To protect your privacy and security, we may initiate a verification process to confirm your identity before processing the deletion.',
          'Upon successful verification, your account and related personal data will be deleted within a reasonable time or as required under applicable laws. You will be notified once the deletion is complete.',
        ],
      },
      {
        heading: 'Request Partial Data Deletion (Account Remains Active)',
        paragraphs: [
          'You can request the deletion of specific personal data without closing your DamnDeal account. Common examples include:',
        ],
        bullets: [
          'Removal of stored addresses',
          'Deletion of saved payment methods',
          'Erasure of search or browsing history',
          'Deletion of optional profile information',
        ],
      },
      {
        heading: 'Data Retention',
        paragraphs: [
          'Even after a deletion request, certain information may be retained where required or permitted by law, such as:',
        ],
        bullets: [
          'Transaction records, invoices, and billing data (retained as per statutory obligations)',
          'Information necessary for fraud prevention, legal claims, or regulatory compliance',
          'Data stored in backup systems, which will be purged as part of our regular data retention cycle',
        ],
      },
    ],
    contact: {
      email: 'info@damndeal.in',
      phone: '+91-76968-27211',
      website: 'www.damndeal.in',
    },
  },

  terms: {
    title: 'User Agreement (Terms & Conditions)',
    effectiveDate: 'April 8, 2025',
    intro: [
      'This User Agreement is entered into between the user of the platform ("User", "You") and DamnDeal ("Company", "We", "Us"), a digital marketplace operating through its website www.damndeal.in and mobile applications.',
      'By registering on, accessing, browsing, or otherwise using the Platform, You acknowledge that You have read, understood, and agreed to be bound by this Agreement and all other policies referenced herein.',
    ],
    sections: [
      {
        heading: 'Eligibility and Acceptance',
        paragraphs: [
          'You must be at least 18 years of age and legally competent under Indian laws to enter into binding contracts to access or use the Platform.',
          'By using the Platform, You confirm that all information provided during registration is accurate and complete, You will maintain the confidentiality of Your account credentials, and Your use of the Platform does not violate any applicable law.',
        ],
      },
      {
        heading: 'About DamnDeal',
        paragraphs: [
          'DamnDeal is an online marketplace that facilitates the listing and sale of goods by independent third-party sellers ("Vendors") to Users. The Platform enables Users to browse, purchase, and receive products sold by such Vendors.',
          'DamnDeal is not a manufacturer, distributor, or seller of products. DamnDeal is merely an intermediary as defined under Section 2(1)(w) of the Information Technology Act, 2000.',
          'All warranties, guarantees, after-sales services, statutory compliances, and product liabilities rest solely with the Vendor.',
        ],
      },
      {
        heading: 'Account Registration and Security',
        paragraphs: [
          'To access certain features of the Platform, You must create an account using a valid email address, phone number, and any other details as required.',
          'You are solely responsible for maintaining the confidentiality of Your account credentials and for all activities that occur under Your account.',
        ],
      },
      {
        heading: 'Purchases and Payments',
        bullets: [
          'You may place an order for products listed by Vendors. Such an order constitutes an offer to purchase, subject to Vendor acceptance.',
          'All prices displayed are inclusive of applicable taxes unless otherwise stated.',
          'Payment must be made at the time of placing the order, via approved payment gateways.',
          'Once an order is placed and confirmed, a binding contract is formed between You and the Vendor.',
        ],
      },
      {
        heading: 'Order Fulfillment and Delivery',
        bullets: [
          'All orders are fulfilled directly by the Vendors. DamnDeal does not hold inventory or deliver products.',
          'Delivery timelines indicated on the Platform are estimates provided by the Vendors.',
          'Risk of loss or damage to goods shall pass to You upon delivery to the shipping carrier.',
        ],
      },
      {
        heading: 'Reward Program',
        paragraphs: [
          'DamnDeal offers a Reward Program where eligible purchases may earn Users rewards based on automatic grouping ("clubbing") of orders. This process is entirely algorithm-driven and may result in reward credit of up to 1% of the total value of the clubbed purchases.',
          'Rewards will be credited as wallet credits and can be used only for future purchases. Rewards are non-transferable, non-redeemable for cash, and subject to expiry.',
          'Any order that is returned, cancelled, or refunded will not be eligible to receive any rewards.',
        ],
      },
      {
        heading: 'User Conduct',
        paragraphs: ['You agree that You shall not:'],
        bullets: [
          'Post, upload, or transmit any content that is unlawful, fraudulent, defamatory, or harmful',
          'Violate any third-party rights, including intellectual property',
          'Interfere with or disrupt the functioning of the Platform or servers',
          'Attempt to gain unauthorized access to any systems, user accounts, or data',
          'Misuse the Reward Program or Referral System through artificial transactions or multiple accounts',
        ],
      },
      {
        heading: 'Intellectual Property',
        paragraphs: [
          'All content on the Platform, including logos, images, videos, text, software, and code, is the intellectual property of DamnDeal or its licensors and is protected under Indian and international copyright and trademark laws.',
        ],
      },
      {
        heading: 'Disclaimer of Warranties',
        paragraphs: [
          'The Platform and all content, features, and services are provided on an "as is" and "as available" basis. DamnDeal makes no warranties or representations regarding the quality, fitness, or merchantability of the products sold by Vendors.',
        ],
      },
      {
        heading: 'Limitation of Liability',
        paragraphs: [
          'To the maximum extent permitted by applicable law, DamnDeal shall not be liable for any indirect, incidental, consequential, special, or punitive damages.',
          'In all cases, DamnDeal\'s aggregate liability shall not exceed the amount paid by You for the specific transaction giving rise to the claim.',
        ],
      },
      {
        heading: 'Suspension and Termination',
        paragraphs: [
          'DamnDeal reserves the right to suspend, restrict, or permanently terminate Your account without notice if You breach any provisions of this Agreement, are involved in fraudulent activity, or as required by law enforcement.',
        ],
      },
      {
        heading: 'Governing Law & Dispute Resolution',
        paragraphs: [
          'This Agreement shall be governed by and construed in accordance with the laws of India. Any disputes shall be subject to the exclusive jurisdiction of the courts located in Patiala, Punjab, India.',
        ],
      },
    ],
    contact: {
      email: 'info@damndeal.in',
      phone: '+91-76968-27211',
      website: 'www.damndeal.in',
    },
  },

  refund: {
    title: 'Refund, Return & Cancellation Policy',
    effectiveDate: 'April 8, 2025',
    intro: [
      'This Refund Policy outlines the terms and conditions for returns, cancellations, and refunds of products purchased through DamnDeal.',
      'By placing an order through the Platform, you agree to be bound by this Refund Policy.',
    ],
    sections: [
      {
        heading: 'Eligibility for Refunds',
        paragraphs: ['Refunds shall only be issued in the following cases:'],
        bullets: [
          'Product received is defective, damaged, or materially different from its description',
          'Order was not delivered within the promised timeframe',
          'Product falls within the category of eligible returns as defined by the Vendor',
        ],
      },
      {
        heading: 'Cancellation Policy',
        bullets: [
          'Cancellations are permitted only before order processing or dispatch',
          'Once dispatched, orders can no longer be cancelled and must go through the return process',
          'To cancel, visit My Orders → select the order → tap Cancel',
        ],
      },
      {
        heading: 'Return Process',
        paragraphs: [
          'To initiate a return, log into your account, navigate to "My Orders", select the eligible product, and click "Return".',
          'Returns must be initiated within the return window specified for each product (typically 7 days from delivery).',
          'Products must be returned in their original packaging, unused, and with all tags/accessories intact.',
        ],
      },
      {
        heading: 'Refund Processing',
        bullets: [
          'Refunds are typically processed within 7–10 business days after the returned item is received and inspected',
          'The refund will be credited to the original payment method used at the time of purchase',
          'For Cash on Delivery (COD) orders, refunds will be processed via bank transfer or wallet credit',
          'Bank processing times may vary based on your payment method and bank',
        ],
      },
      {
        heading: 'Non-Refundable Items',
        paragraphs: ['Certain items may not be eligible for return or refund, including:'],
        bullets: [
          'Perishable items (food, flowers, etc.)',
          'Personal care items and intimate apparel',
          'Customized or personalized products',
          'Digital downloads or services already rendered',
          'Items marked as "Non-Returnable" on the product page',
        ],
      },
      {
        heading: 'Damaged or Defective Products',
        paragraphs: [
          'If you receive a damaged or defective product, please report it within 48 hours of delivery by contacting our support team.',
          'Provide clear photographs of the product and packaging to help us process your claim faster.',
        ],
      },
      {
        heading: 'Vendor Liability',
        paragraphs: [
          'All product liabilities, warranties, and after-sales support rest solely with the Vendor. DamnDeal acts as an intermediary and facilitates the refund process.',
        ],
      },
      {
        heading: 'Need Help?',
        paragraphs: [
          'For any issues regarding refunds, returns, or cancellations, please contact our customer support team. We are here to assist you.',
        ],
      },
    ],
    contact: {
      email: 'info@damndeal.in',
      phone: '+91-76968-27211',
      website: 'www.damndeal.in',
    },
  },

  vendor: {
    title: 'Vendor / Partner Terms and Conditions',
    effectiveDate: 'April 9, 2025',
    intro: [
      'This Vendor Terms and Conditions Agreement is entered into by and between DamnDeal ("Platform", "We", "Us", or "Our"), and any natural or legal person who lists, offers, or sells products or services on the Platform ("Vendor", "You", or "Your").',
      'By registering as a Vendor on the Platform, You agree to be bound by the terms of this Agreement and all applicable Platform policies.',
    ],
    sections: [
      {
        heading: 'Registration and Onboarding',
        paragraphs: [
          'You represent and warrant that You are legally capable of entering into a contract and that all information provided during registration is accurate, complete, and up to date.',
          'You agree to provide necessary documentation for verification, including:',
        ],
        bullets: [
          'GST registration',
          'PAN and Aadhaar (in case of individuals)',
          'Bank account details',
          'Business registration/license',
        ],
      },
      {
        heading: 'Listing Products',
        bullets: [
          'You shall ensure that all Listings are accurate, complete, and in compliance with applicable laws',
          'Vendors shall not list banned/restricted products, counterfeit goods, or expired/unlicensed products',
          'You are solely responsible for maintaining adequate inventory and timely updating of stock',
          'Failure to fulfil orders may result in penalties or suspension',
        ],
      },
      {
        heading: 'Pricing and Payment',
        bullets: [
          'You have the sole authority to determine the price of Products, subject to MRP limits under the law',
          'DamnDeal may charge a commission, service fee, or transaction fee as agreed at onboarding',
          'Payments due to the Vendor shall be settled within 7–15 business days, after deduction of fees, penalties, refunds, and taxes',
        ],
      },
      {
        heading: 'Order Fulfillment and Shipping',
        bullets: [
          'You are solely responsible for processing, packaging, and shipping the Orders to Users',
          'Orders must be shipped within the timeframe indicated in the listing',
          'You must provide valid tracking details and confirm dispatch through the Platform interface',
        ],
      },
      {
        heading: 'Returns, Refunds, and Cancellations',
        paragraphs: [
          'You agree to honour all return, replacement, and refund requests in accordance with the DamnDeal Refund Policy.',
          'All liability for product defects, warranty claims, manufacturing faults, or damages rests solely with the Vendor.',
          'Any refunds, reversals, or chargebacks initiated by the User or payment gateway will be recovered from Your future payouts.',
        ],
      },
      {
        heading: 'Taxes and Compliance',
        paragraphs: [
          'You are solely responsible for compliance with all tax laws, including GST registration, tax collection, invoicing, and reporting obligations.',
          'You shall issue tax invoices directly to the User and ensure that applicable GST is correctly levied and disclosed.',
        ],
      },
      {
        heading: 'Intellectual Property',
        paragraphs: [
          'You warrant that all content, images, trademarks, and branding used in Your listings are either owned by You or duly licensed.',
          'DamnDeal reserves the right to remove or disable access to any listing that allegedly violates IP rights, without prior notice.',
        ],
      },
      {
        heading: 'Warranties and Representations',
        paragraphs: ['You represent and warrant that:'],
        bullets: [
          'You have the legal right and authority to sell Products',
          'Your Products conform to applicable quality, safety, and regulatory standards',
          'You shall not engage in any deceptive, fraudulent, or illegal trade practices',
        ],
      },
      {
        heading: 'Limitation of Liability',
        paragraphs: [
          'DamnDeal acts solely as an intermediary and shall not be liable for claims arising out of or relating to the Products, losses due to Vendor non-performance, or third-party IP/statutory violations.',
          'DamnDeal\'s total liability, if any, shall be limited to the commission earned on the specific transaction in question.',
        ],
      },
      {
        heading: 'Suspension and Termination',
        paragraphs: [
          'DamnDeal may, at its sole discretion, suspend or terminate Your Vendor account if You breach any terms, list prohibited products, engage in fraudulent practices, or violate applicable laws.',
          'Upon termination, You must fulfil all pending Orders and settle all financial obligations.',
        ],
      },
      {
        heading: 'Governing Law & Dispute Resolution',
        paragraphs: [
          'This Agreement shall be governed by and construed in accordance with the laws of India. Any disputes shall be subject to the exclusive jurisdiction of the courts located in Patiala, Punjab, India.',
        ],
      },
    ],
    contact: {
      email: 'info@damndeal.in',
      phone: '+91-76968-27211',
      website: 'www.damndeal.in',
    },
  },
};

export const LEGAL_SLUGS = Object.keys(LEGAL_DOCS);
