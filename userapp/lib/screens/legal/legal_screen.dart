import 'package:flutter/material.dart';
import '../../theme/app_theme.dart';

class LegalScreen extends StatelessWidget {
  const LegalScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final type = ModalRoute.of(context)?.settings.arguments as String? ?? 'terms';

    String title;
    String content;
    switch (type) {
      case 'privacy':
        title = 'Privacy Policy';
        content = _privacyPolicy;
        break;
      case 'refund':
        title = 'Refund Policy';
        content = _refundPolicy;
        break;
      default:
        title = 'Terms & Conditions';
        content = _termsConditions;
    }

    return Scaffold(
      appBar: AppBar(title: Text(title)),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Text(content, style: const TextStyle(fontSize: 14, color: AppColors.textSecondary, height: 1.7)),
      ),
    );
  }
}

const _termsConditions = '''
Terms & Conditions

Last Updated: April 2026

1. Acceptance of Terms
By downloading, installing, or using DamnDeal ("App"), you agree to these Terms & Conditions. If you do not agree, do not use the App.

2. Account Registration
You must provide a valid mobile number to create an account. You are responsible for maintaining the confidentiality of your account credentials.

3. Services
DamnDeal is a hyperlocal commerce platform that connects users with local shops and delivery partners. We facilitate the discovery, ordering, and delivery of products.

4. Orders & Payments
- All prices displayed are inclusive of applicable taxes unless stated otherwise
- Orders once placed cannot be modified; they can only be cancelled if the status is "Placed" or "Confirmed"
- Cash on Delivery (COD) and Online Payment options are available
- Payment processing is handled by secure third-party payment gateways

5. Delivery
- Delivery times are estimated and may vary based on distance, traffic, and order volume
- Delivery charges are displayed during checkout before order confirmation
- Free delivery is available above certain order amounts as specified by individual shops

6. Cancellation & Returns
- Orders can be cancelled before they reach "Preparing" status
- Return requests can be raised within the applicable window for delivered orders
- Refunds are processed to the wallet or original payment method

7. User Conduct
Users agree not to misuse the platform, place fraudulent orders, or engage in any activity that violates applicable laws.

8. Limitation of Liability
DamnDeal acts as an intermediary platform and is not liable for the quality of products sold by partner shops.

9. Changes to Terms
We reserve the right to modify these terms at any time. Continued use of the App constitutes acceptance of updated terms.

10. Contact
For queries, reach us through the in-app support section.
''';

const _privacyPolicy = '''
Privacy Policy

Last Updated: April 2026

1. Information We Collect
- Phone number for authentication
- Name and email for profile completion
- Delivery addresses for order fulfillment
- Location data for showing nearby shops and delivery tracking
- Device information for app optimization

2. How We Use Your Information
- To create and manage your account
- To process and deliver orders
- To communicate order updates via notifications
- To improve our services and user experience
- To prevent fraud and ensure security

3. Data Sharing
- We share your delivery address with delivery partners only for order fulfillment
- We share your order details with partner shops for order preparation
- We do not sell your personal data to third parties
- Payment information is handled by secure payment processors

4. Data Security
We implement industry-standard security measures to protect your personal information, including encryption and secure data storage.

5. Data Retention
We retain your data for as long as your account is active. You can request account deletion by contacting support.

6. Your Rights
- Access your personal data
- Update or correct your information
- Delete your account
- Opt out of marketing communications

7. Cookies & Analytics
We may use analytics tools to understand app usage patterns and improve our services.

8. Changes
We may update this policy periodically. We will notify you of significant changes.
''';

const _refundPolicy = '''
Refund Policy

Last Updated: April 2026

1. Eligibility
- Refunds are available for cancelled orders and approved return requests
- Orders cancelled before "Preparing" status are eligible for full refund
- Delivered orders may be eligible for return/refund based on the return policy

2. Refund Methods
- Online payments: Refund to original payment method or wallet
- COD orders: Refund credited to DamnDeal wallet
- Wallet payments: Refund credited back to wallet

3. Processing Time
- Wallet refunds: Processed instantly
- Online payment refunds: 5-7 business days

4. Non-Refundable
- Perishable items once delivered and accepted
- Items damaged due to user mishandling
- Partial consumption of products

5. Return Process
- Raise a return request from the order details screen
- Provide reason for return
- Our team will review and process the request within 24-48 hours
- If approved, delivery partner will collect the items

6. Contact
For refund queries, use the in-app support section or raise a ticket.
''';
