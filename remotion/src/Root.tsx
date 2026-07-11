import { Composition } from 'remotion'
import { StarChart } from './StarChart'
import { Intro } from './Intro'
import { VerdictCard } from './VerdictCard'
import { ThumbTemplate } from './ThumbTemplate'
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
    <Composition
      id="ThumbTemplate"
      component={ThumbTemplate}
      durationInFrames={1}
      fps={30}
      width={1280}
      height={720}
      defaultProps={{
        hookText: '8 лет в Meta?',
        repoName: 'facebook/astryx',
        verdict: 'ГОДНОТА',
        bgVariant: 0,
      }}
    />
  </>
)
