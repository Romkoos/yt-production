import { Composition } from 'remotion'
import { StarChart } from './StarChart'
import { Intro } from './Intro'
import { VerdictCard } from './VerdictCard'
import { ThumbTemplate } from './ThumbTemplate'
import { thumbSchema } from './thumb-schema'
import { THUMB_PRESETS, THUMB_ASTRYX_A } from './thumb-presets'
import { TEST_STARCHART } from './starchart-data'

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
      defaultProps={{ verdict: 'ГОДНОТА', repoName: 'facebook/astryx' }}
    />
    {/* Generic composition (default props = variant A) for future episodes / studio. */}
    <Composition
      id="ThumbTemplate"
      component={ThumbTemplate}
      schema={thumbSchema}
      durationInFrames={1}
      fps={30}
      width={1280}
      height={720}
      defaultProps={THUMB_ASTRYX_A}
    />
    {/* ep001 presets — three genuinely different compositions, rendered as stills. */}
    {Object.entries(THUMB_PRESETS).map(([id, props]) => (
      <Composition
        key={id}
        id={id}
        component={ThumbTemplate}
        schema={thumbSchema}
        durationInFrames={1}
        fps={30}
        width={1280}
        height={720}
        defaultProps={props}
      />
    ))}
  </>
)
