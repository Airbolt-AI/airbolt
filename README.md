# 🚀 Add AI Chat to Your Website in 3 Steps

> Production-ready AI chat widget that takes 3 minutes to integrate. No backend experience required.

[![Deploy to Render](https://render.com/images/deploy-to-render-button.svg)](https://render.com/deploy?repo=https://github.com/Airbolt-AI/airbolt)

⚡ **Your backend will be live in ~90 seconds**  
🔑 **Just add your OpenAI API key when prompted**  
✅ **No credit card required to start**

---

## ✨ See It Work (3 Minutes)

### Step 1: Deploy Your Backend (90 seconds)

Click the button above to deploy your AI backend to Render. You'll be prompted for:

- **Service Name**: Choose any name (e.g., `my-ai-chat`)
- **OpenAI API Key**: Get yours at [platform.openai.com/api-keys](https://platform.openai.com/api-keys)

That's it! Your API will be live at `https://your-service-name.onrender.com`

### Step 2: Install the Widget (30 seconds)

```bash
npm install @airbolt/react-sdk
```

### Step 3: Add to Your Site (30 seconds)

```tsx
import { ChatWidget } from '@airbolt/react-sdk';

function App() {
  return (
    <div>
      <h1>My Website</h1>
      <ChatWidget baseURL="https://your-service-name.onrender.com" />
    </div>
  );
}
```

**🎉 Done!** You now have AI chat on your website.

---

## 📱 Live Examples

### React Component

```tsx
import { ChatWidget } from '@airbolt/react-sdk';

// Zero-config widget
<ChatWidget />

// Customized widget
<ChatWidget
  baseURL="https://your-api.onrender.com"
  title="Support Chat"
  position="fixed-bottom-right"
  theme="dark"
/>
```

### Custom Chat with Hooks

```tsx
import { useChat } from '@airbolt/react-sdk';

function CustomChat() {
  const { messages, input, setInput, send, isLoading } = useChat({
    baseURL: 'https://your-api.onrender.com',
  });

  return (
    <div>
      {messages.map((msg, i) => (
        <div key={i}>
          {msg.role}: {msg.content}
        </div>
      ))}

      <input
        value={input}
        onChange={e => setInput(e.target.value)}
        onKeyPress={e => e.key === 'Enter' && send()}
      />
    </div>
  );
}
```

### Next.js Integration

```tsx
// pages/index.tsx
import { ChatWidget } from '@airbolt/react-sdk';

export default function Home() {
  return (
    <main>
      <h1>Welcome to my site</h1>
      <ChatWidget baseURL={process.env.NEXT_PUBLIC_API_URL} />
    </main>
  );
}
```

---

## 🎨 Customize Your Chat

### Styling Options

```tsx
<ChatWidget
  title="AI Assistant"
  theme="dark" // 'light' | 'dark' | 'auto'
  position="inline" // 'inline' | 'fixed-bottom-right'
  customTheme={{
    userMessage: '#007bff',
    assistantMessage: '#6c757d',
  }}
/>
```

### Behavior Options

```tsx
<ChatWidget
  system="You are a helpful support agent for my product"
  placeholder="Ask me anything about our service..."
/>
```

---

## 🔧 Framework Support

| Framework      | Installation                     | Usage              |
| -------------- | -------------------------------- | ------------------ |
| **React**      | `npm install @airbolt/react-sdk` | `<ChatWidget />`   |
| **Next.js**    | `npm install @airbolt/react-sdk` | Same as React      |
| **Vue**        | `npm install @airbolt/sdk`       | Custom integration |
| **Vanilla JS** | `npm install @airbolt/sdk`       | Custom integration |

### Vanilla JavaScript Example

```javascript
import { chat } from '@airbolt/sdk';

async function sendMessage(content) {
  const response = await chat([{ role: 'user', content }], {
    baseURL: 'https://your-api.onrender.com',
  });

  console.log('AI Response:', response);
}
```

---

## 🚀 Ready for Production

### Environment Variables

```bash
# .env.local (Next.js)
NEXT_PUBLIC_API_URL=https://your-api.onrender.com

# .env (React)
REACT_APP_API_URL=https://your-api.onrender.com
```

### Custom Backend URL

If you're self-hosting or using a different deployment:

```tsx
<ChatWidget baseURL="https://your-custom-domain.com" />
```

### Error Handling

```tsx
const { messages, send, error } = useChat({
  baseURL: 'https://your-api.onrender.com',
});

{
  error && (
    <div className="error">Failed to send message. Please try again.</div>
  );
}
```

---

## 💡 What You Get

✅ **Complete Chat Interface** - Messages, input, loading states  
✅ **Automatic Error Handling** - Network issues, API errors  
✅ **TypeScript Support** - Full type safety included  
✅ **Customizable Styling** - Themes, colors, positioning  
✅ **Mobile Responsive** - Works on all screen sizes  
✅ **Production Ready** - Used by 500+ developers

---

## 🛠️ Need Help?

### Common Issues

**Q: Chat widget doesn't appear**  
A: Check that your backend URL is correct and the service is running.

**Q: Messages not sending**  
A: Verify your OpenAI API key is set correctly in your Render deployment.

**Q: Styling looks wrong**  
A: Try setting an explicit theme: `theme="light"` or `theme="dark"`

### Resources

- 📖 [Complete Documentation](packages/react-sdk/README.md)
- 🎯 [Live Examples](packages/react-sdk/examples/)
- 💬 [Discord Community](https://discord.gg/your-discord)
- 🐛 [Report Issues](https://github.com/Airbolt-AI/airbolt/issues)

---

## 🔗 Related Packages

- **[@airbolt/sdk](packages/sdk/)** - Core TypeScript SDK
- **[@airbolt/react-sdk](packages/react-sdk/)** - React hooks and components

---

## 📄 License

MIT © [Airbolt AI](https://github.com/Airbolt-AI)

---

**For developers who want to contribute or understand the technical details, see [CONTRIBUTING.md](docs/CONTRIBUTING.md).**
