import { useState } from 'react';
import { useLocation } from 'wouter';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import Navbar from '@/components/Navbar';
import { Brain, Users, Code, Server, ArrowRight, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

export default function NewCollaborationSession() {
  const [, setLocation] = useLocation();
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    type: 'frontend-backend',
    privacy: 'shared',
  });

  const collaborationTypes = [
    {
      value: 'frontend-backend',
      label: 'Frontend + Backend',
      description: 'One AI handles UI, another builds the API',
      icon: Users,
      recommended: true,
    },
    {
      value: 'dual-frontend',
      label: 'Two Frontend Agents',
      description: 'Collaborative UI development',
      icon: Code,
    },
    {
      value: 'dual-backend',
      label: 'Two Backend Agents',
      description: 'API design and implementation together',
      icon: Server,
    },
    {
      value: 'custom',
      label: 'Custom Roles',
      description: 'Define your own collaboration pattern',
      icon: Brain,
    },
  ];

  const privacyOptions = [
    {
      value: 'private',
      label: 'Private',
      description: 'Only you can view this session',
    },
    {
      value: 'shared',
      label: 'Shared Link',
      description: 'Anyone with the link can view (recommended)',
    },
    {
      value: 'public',
      label: 'Public',
      description: 'Listed in community gallery',
    },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.name) {
      toast.error('Please enter a session name');
      return;
    }

    setIsCreating(true);

    try {
      // TODO: API call to create session
      // const response = await trpc.collaboration.createSession.mutate(formData);

      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1500));

      const sessionId = 'demo_' + Math.random().toString(36).substring(7);

      toast.success('Collaboration session created!');
      setLocation(`/ai-collaboration/connect/${sessionId}`);
    } catch (error) {
      toast.error('Failed to create session');
      console.error(error);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
      <Navbar />

      <div className="container mx-auto px-4 py-16 max-w-3xl">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Brain className="h-12 w-12 text-purple-400" />
            <h1 className="text-4xl md:text-5xl font-bold text-white">
              Create Collaboration Session
            </h1>
          </div>
          <p className="text-xl text-slate-300">
            Set up a shared cognitive space for AI teamwork
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>
          <Card className="p-8 bg-slate-900/50 border-slate-800 space-y-8">
            {/* Session Name */}
            <div className="space-y-2">
              <Label htmlFor="name" className="text-white text-lg">
                Session Name *
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., User Dashboard Development"
                className="bg-slate-800 border-slate-700 text-white text-lg"
                required
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="description" className="text-white text-lg">
                Project Description
              </Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Building a user dashboard with real-time charts and settings management..."
                className="bg-slate-800 border-slate-700 text-white min-h-[120px]"
              />
            </div>

            {/* Collaboration Type */}
            <div className="space-y-4">
              <Label className="text-white text-lg">Collaboration Type</Label>
              <RadioGroup
                value={formData.type}
                onValueChange={(value) => setFormData({ ...formData, type: value })}
              >
                <div className="grid md:grid-cols-2 gap-4">
                  {collaborationTypes.map((type) => (
                    <label
                      key={type.value}
                      className={`relative flex cursor-pointer ${
                        formData.type === type.value
                          ? 'ring-2 ring-purple-500'
                          : 'hover:border-slate-600'
                      } rounded-lg border-2 border-slate-700 p-4 transition-all`}
                    >
                      <RadioGroupItem value={type.value} className="sr-only" />
                      <div className="flex-1">
                        <div className="flex items-start gap-3 mb-2">
                          <div className="bg-purple-500/10 p-2 rounded-lg">
                            <type.icon className="h-5 w-5 text-purple-400" />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-white">
                                {type.label}
                              </span>
                              {type.recommended && (
                                <span className="text-xs bg-green-500/10 text-green-400 px-2 py-0.5 rounded">
                                  Recommended
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-slate-400 mt-1">
                              {type.description}
                            </p>
                          </div>
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </RadioGroup>
            </div>

            {/* Privacy */}
            <div className="space-y-4">
              <Label className="text-white text-lg">Privacy Settings</Label>
              <RadioGroup
                value={formData.privacy}
                onValueChange={(value) => setFormData({ ...formData, privacy: value })}
              >
                <div className="space-y-3">
                  {privacyOptions.map((option) => (
                    <label
                      key={option.value}
                      className={`relative flex cursor-pointer ${
                        formData.privacy === option.value
                          ? 'ring-2 ring-purple-500'
                          : 'hover:border-slate-600'
                      } rounded-lg border border-slate-700 p-4 transition-all`}
                    >
                      <RadioGroupItem value={option.value} className="mt-1" />
                      <div className="ml-4 flex-1">
                        <span className="font-medium text-white">{option.label}</span>
                        <p className="text-sm text-slate-400 mt-1">{option.description}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </RadioGroup>
            </div>

            {/* Submit */}
            <div className="flex justify-end gap-4 pt-6 border-t border-slate-800">
              <Button
                type="button"
                variant="outline"
                onClick={() => setLocation('/ai-collaboration')}
                className="border-slate-700"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isCreating}
                className="bg-gradient-to-r from-purple-500 to-cyan-500 hover:from-purple-600 hover:to-cyan-600 text-white"
              >
                {isCreating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Creating...
                  </>
                ) : (
                  <>
                    Create Session
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </>
                )}
              </Button>
            </div>
          </Card>
        </form>

        {/* Info Card */}
        <Card className="mt-6 p-6 bg-slate-900/30 border-slate-800">
          <h3 className="text-lg font-semibold text-white mb-3">💡 What happens next?</h3>
          <ul className="text-sm text-slate-400 space-y-2 list-disc list-inside">
            <li>You'll get a unique session ID and shareable link</li>
            <li>Connect your AI agents (Manus, Claude) via QR code or config</li>
            <li>Watch real-time collaboration on the live dashboard</li>
            <li>Export transcripts and code when complete</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
