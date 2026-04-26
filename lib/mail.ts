import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export const sendEmail = async (to: string, subject: string, html: string) => {
  try {
    console.log(`[Email] Attempting to send to ${to}...`);
    const info = await transporter.sendMail({
      from: `"GenBox Studio" <${process.env.EMAIL_USER}>`,
      to,
      subject,
      html,
    });
    console.log('[Email] Success! Message ID:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error: any) {
    console.error('[Email Error] Details:', {
      message: error.message,
      code: error.code,
      command: error.command,
    });
    return { success: false, error };
  }
};

// --- Templates ---

export const getSubscriptionTemplate = (userName: string, planName: string, expiryDate: string) => `
  <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
    <h2 style="color: #6366f1;">Welcome to GenBox ${planName}!</h2>
    <p>Hi ${userName},</p>
    <p>Your subscription to the <strong>${planName} Plan</strong> is now active. You have unlocked premium voices, longer generation limits, and cinematic BGM mixing.</p>
    <div style="background: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
      <p style="margin: 0;"><strong>Plan:</strong> ${planName}</p>
      <p style="margin: 0;"><strong>Expires on:</strong> ${expiryDate}</p>
    </div>
    <p>Go ahead and create your next masterpiece in the Studio!</p>
    <a href="${process.env.NEXT_PUBLIC_APP_URL}/studio" style="display: inline-block; padding: 12px 24px; background: #6366f1; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">Go to Studio</a>
    <hr style="margin: 30px 0; border: 0; border-top: 1px solid #eee;" />
    <p style="font-size: 12px; color: #64748b;">If you didn't expect this email, please ignore it.</p>
  </div>
`;

export const getExpiryWarningTemplate = (userName: string, daysLeft: number) => `
  <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
    <h2 style="color: #f43f5e;">Action Required: Subscription Expiring</h2>
    <p>Hi ${userName},</p>
    <p>Your GenBox Pro subscription will expire in <strong>${daysLeft} days</strong>. To continue using premium broadcast features without interruption, please renew your plan.</p>
    <a href="${process.env.NEXT_PUBLIC_APP_URL}/pricing" style="display: inline-block; padding: 12px 24px; background: #f43f5e; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">Renew Now</a>
    <p style="margin-top: 20px;">Stay creative!</p>
  </div>
`;

export const getUpdateTemplate = (updateTitle: string, content: string) => `
  <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
    <h2 style="color: #6366f1;">New Update: ${updateTitle}</h2>
    <p>${content}</p>
    <a href="${process.env.NEXT_PUBLIC_APP_URL}/studio" style="display: inline-block; padding: 12px 24px; background: #6366f1; color: white; text-decoration: none; border-radius: 5px; font-weight: bold;">Check it out</a>
  </div>
`;

export const getFreeWelcomeTemplate = (userName: string) => `
  <div style="font-family: sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
    <h2 style="color: #6366f1;">Thank you for joining GenBox!</h2>
    <p>Hi ${userName},</p>
    <p>We are thrilled to have you onboard! You can now start generating high-quality AI scripts and voices for free.</p>
    
    <div style="background: #eff6ff; padding: 20px; border-radius: 10px; margin: 25px 0; border: 1px solid #bfdbfe;">
      <h3 style="color: #1e40af; margin-top: 0;">🚀 Upgrade to Pro for Cinematic Power!</h3>
      <p style="color: #1e3a8a;">Take your content to the next level with our <strong>Pro Plan</strong>:</p>
      <ul style="color: #1e3a8a; padding-left: 20px;">
        <li><strong>Unlimited Broadcasts:</strong> Long-form audio without limits.</li>
        <li><strong>Pro AI Voices:</strong> More natural and expressive tones.</li>
        <li><strong>Auto BGM Mixing:</strong> Cinematic background music with smart ducking.</li>
        <li><strong>Higher Daily Limits:</strong> Create more, faster.</li>
      </ul>
      <a href="${process.env.NEXT_PUBLIC_APP_URL}/pricing" style="display: inline-block; margin-top: 10px; padding: 10px 20px; background: #1e40af; color: white; text-decoration: none; border-radius: 6px; font-weight: bold;">See Pro Plans</a>
    </div>

    <p>Need help getting started? Just reply to this email.</p>
    <p>Happy Creating!<br/><strong>The GenBox Team</strong></p>
  </div>
`;
