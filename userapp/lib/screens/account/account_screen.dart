import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../services/auth_service.dart';
import '../../services/app_config_service.dart';
import '../../theme/app_theme.dart';

class AccountScreen extends StatelessWidget {
  const AccountScreen({super.key});

  Future<void> _open(String url) async {
    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) await launchUrl(uri, mode: LaunchMode.externalApplication);
  }

  @override
  Widget build(BuildContext context) {
    final auth = context.watch<AuthService>();
    final cfg = context.watch<AppConfigService>().config;
    final supportPhone = cfg['support_phone']?.toString() ?? '';
    final supportEmail = cfg['support_email']?.toString() ?? '';
    final instagramUrl = cfg['instagram_url']?.toString() ?? '';

    return Scaffold(
      appBar: AppBar(title: const Text('Account')),
      body: ListView(
        children: [
          // Profile card
          Container(
            margin: const EdgeInsets.all(12),
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [AppColors.primary, AppColors.primaryDark],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(16),
            ),
            child: auth.isLoggedIn
                ? Row(
                    children: [
                      CircleAvatar(
                        radius: 26,
                        backgroundColor: Colors.white.withValues(alpha: 0.2),
                        child: Text(
                          auth.userName.isNotEmpty ? auth.userName[0].toUpperCase() : '?',
                          style: const TextStyle(color: Colors.white, fontSize: 22, fontWeight: FontWeight.w800),
                        ),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(auth.userName.isNotEmpty ? auth.userName : 'Welcome',
                                style: const TextStyle(color: Colors.white, fontSize: 17, fontWeight: FontWeight.w800)),
                            const SizedBox(height: 2),
                            Text(auth.userPhone,
                                style: TextStyle(color: Colors.white.withValues(alpha: 0.85), fontSize: 13)),
                            if ((auth.user?['email'] ?? '').toString().isNotEmpty)
                              Text(auth.user?['email'] ?? '',
                                  style: TextStyle(color: Colors.white.withValues(alpha: 0.7), fontSize: 11)),
                          ],
                        ),
                      ),
                      IconButton(
                        onPressed: () => Navigator.pushNamed(context, '/complete-profile'),
                        icon: const Icon(Icons.edit_outlined, color: Colors.white, size: 20),
                      ),
                    ],
                  )
                : Row(
                    children: [
                      const CircleAvatar(
                        radius: 26,
                        backgroundColor: Colors.white24,
                        child: Icon(Icons.person, color: Colors.white, size: 26),
                      ),
                      const SizedBox(width: 14),
                      const Expanded(
                        child: Text('Login to your account',
                            style: TextStyle(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w700)),
                      ),
                      ElevatedButton(
                        onPressed: () => Navigator.pushNamed(context, '/login'),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.white,
                          foregroundColor: AppColors.primary,
                          padding: const EdgeInsets.symmetric(horizontal: 18),
                        ),
                        child: const Text('Login'),
                      ),
                    ],
                  ),
          ),

          if (auth.isLoggedIn)
            _group('My Activity', [
              _item(context, Icons.receipt_long_rounded, 'My Orders', '/orders'),
              _item(context, Icons.assignment_return_rounded, 'My Returns', '/returns'),
              _item(context, Icons.account_balance_wallet_rounded, 'Wallet', '/wallet'),
              _item(context, Icons.workspace_premium_rounded, 'Magic Club', '/magic-club'),
              _item(context, Icons.casino_rounded, 'Magic Pools', '/magic-pools/mine'),
              _item(context, Icons.location_on_rounded, 'Saved Addresses', '/addresses'),
            ]),

          _group('Help & Info', [
            if (supportPhone.isNotEmpty)
              _itemAction(Icons.phone_rounded, 'Contact Support', supportPhone, () => _open('tel:$supportPhone')),
            if (supportEmail.isNotEmpty)
              _itemAction(Icons.mail_outline_rounded, 'Email Support', supportEmail, () => _open('mailto:$supportEmail')),
            if (instagramUrl.isNotEmpty)
              _itemAction(Icons.camera_alt_outlined, 'Follow on Instagram', null, () => _open(instagramUrl)),
            if (supportPhone.isEmpty && supportEmail.isEmpty)
              _itemAction(Icons.help_outline_rounded, 'Help & Support', null, () {}),
          ]),

          _group('Legal', [
            _item(context, Icons.description_outlined, 'Terms & Conditions', '/legal', arg: 'terms'),
            _item(context, Icons.privacy_tip_outlined, 'Privacy Policy', '/legal', arg: 'privacy'),
            _item(context, Icons.gavel_rounded, 'Refund Policy', '/legal', arg: 'refund'),
            _item(context, Icons.business_outlined, 'Vendor Terms', '/legal', arg: 'vendor'),
          ]),

          // Company info
          Container(
            margin: const EdgeInsets.fromLTRB(12, 16, 12, 8),
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: AppColors.divider,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('DAMNDEAL INDIA PRIVATE LIMITED',
                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800)),
                const SizedBox(height: 6),
                _line(Icons.location_on_outlined, 'Punjab, India'),
                _line(Icons.numbers_rounded, 'CIN: U47912PB2025PTC064208'),
                _line(Icons.receipt_outlined, 'GSTIN: 03AALCD6016H1ZW'),
              ],
            ),
          ),

          if (auth.isLoggedIn) ...[
            Padding(
              padding: const EdgeInsets.fromLTRB(12, 8, 12, 4),
              child: OutlinedButton.icon(
                onPressed: () async {
                  final confirm = await showDialog<bool>(
                    context: context,
                    builder: (ctx) => AlertDialog(
                      title: const Text('Logout'),
                      content: const Text('Are you sure you want to logout?'),
                      actions: [
                        TextButton(onPressed: () => Navigator.pop(ctx, false), child: const Text('Cancel')),
                        TextButton(
                          onPressed: () => Navigator.pop(ctx, true),
                          child: const Text('Logout', style: TextStyle(color: AppColors.error)),
                        ),
                      ],
                    ),
                  );
                  if (confirm == true) {
                    await auth.logout();
                    if (context.mounted) {
                      Navigator.pushNamedAndRemoveUntil(context, '/login', (_) => false);
                    }
                  }
                },
                icon: const Icon(Icons.logout_rounded, color: AppColors.error),
                label: const Text('Logout', style: TextStyle(color: AppColors.error)),
                style: OutlinedButton.styleFrom(
                  side: const BorderSide(color: AppColors.error),
                  minimumSize: const Size(double.infinity, 44),
                ),
              ),
            ),
          ],

          const SizedBox(height: 18),
          const Center(
            child: Text('DamnDeal v1.0.0',
                style: TextStyle(fontSize: 11, color: AppColors.textMuted)),
          ),
          const SizedBox(height: 24),
        ],
      ),
    );
  }

  Widget _group(String title, List<Widget> items) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 6),
          child: Text(title.toUpperCase(),
              style: const TextStyle(
                  fontSize: 11, fontWeight: FontWeight.w800, color: AppColors.textMuted, letterSpacing: 0.5)),
        ),
        Container(
          margin: const EdgeInsets.symmetric(horizontal: 12),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(12),
            border: Border.all(color: AppColors.border),
          ),
          child: Column(children: items),
        ),
      ],
    );
  }

  Widget _item(BuildContext context, IconData icon, String title, String route, {Object? arg}) {
    return ListTile(
      leading: Icon(icon, color: AppColors.primary, size: 22),
      title: Text(title, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
      trailing: const Icon(Icons.chevron_right, color: AppColors.textMuted, size: 20),
      onTap: () => Navigator.pushNamed(context, route, arguments: arg),
      dense: true,
      shape: const Border(bottom: BorderSide(color: AppColors.divider, width: 0.5)),
    );
  }

  Widget _itemAction(IconData icon, String title, String? subtitle, VoidCallback onTap) {
    return ListTile(
      leading: Icon(icon, color: AppColors.primary, size: 22),
      title: Text(title, style: const TextStyle(fontSize: 14, fontWeight: FontWeight.w600)),
      subtitle: subtitle != null ? Text(subtitle, style: const TextStyle(fontSize: 11)) : null,
      trailing: const Icon(Icons.open_in_new_rounded, color: AppColors.textMuted, size: 16),
      onTap: onTap,
      dense: true,
      shape: const Border(bottom: BorderSide(color: AppColors.divider, width: 0.5)),
    );
  }

  Widget _line(IconData icon, String text) {
    return Padding(
      padding: const EdgeInsets.only(top: 4),
      child: Row(
        children: [
          Icon(icon, size: 12, color: AppColors.textMuted),
          const SizedBox(width: 6),
          Expanded(child: Text(text, style: const TextStyle(fontSize: 11, color: AppColors.textSecondary))),
        ],
      ),
    );
  }
}
