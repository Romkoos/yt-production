import { Composition } from 'remotion'
import { StarChart } from './StarChart'
import { Intro } from './Intro'
import { VerdictCard } from './VerdictCard'
import { ThumbTemplate } from './ThumbTemplate'
import { thumbSchema, type ThumbTemplateProps } from './thumb-schema'
import { TEST_STARCHART } from './starchart-data'

// Generic placeholder props for the ThumbTemplate Studio composition. Glyph-only focal object (no
// image file), neutral repo/hook — episode-specific presets are generated per episode, not baked in.
const THUMB_DEFAULT: ThumbTemplateProps = {
  layout: 'logo-right',
  accent: '#58a6ff',
  repoName: 'org/repo',
  verdict: 'ГОДНОТА',
  verdictPosition: 'in-brick',
  logo: { glyph: '>_' },
  hookBlock: true,
  hookFont: 'unbounded',
  hook: [
    { text: 'Заголовок', size: 'md', weight: 700 },
    { text: 'хук', size: 'xl', accent: true },
  ],
}

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="StarChart"
      component={StarChart}
      durationInFrames={120}
      fps={30}
      width={1920}
      height={1080}
      defaultProps={TEST_STARCHART}
    />
    <Composition
      id="Intro"
      component={Intro}
      durationInFrames={90}
      fps={30}
      width={1920}
      height={1080}
      defaultProps={{ episodeNumber: 1 }}
    />
    <Composition
      id="VerdictCard"
      component={VerdictCard}
      durationInFrames={90}
      fps={30}
      width={1920}
      height={1080}
      defaultProps={{ verdict: 'ГОДНОТА', repoName: 'org/repo' }}
    />
    {/* Generic composition (glyph-only placeholder props) for future episodes / studio. */}
    <Composition
      id="ThumbTemplate"
      component={ThumbTemplate}
      schema={thumbSchema}
      durationInFrames={1}
      fps={30}
      width={1280}
      height={720}
      defaultProps={THUMB_DEFAULT}
    />
  </>
)
