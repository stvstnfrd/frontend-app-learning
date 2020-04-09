/* eslint-disable import/prefer-default-export */
import { getConfig, camelCaseObject } from '@edx/frontend-platform';
import { getAuthenticatedHttpClient, getAuthenticatedUser } from '@edx/frontend-platform/auth';
import { logError } from '@edx/frontend-platform/logging';

function normalizeMetadata(metadata) {
  return {
    contentTypeGatingEnabled: metadata.content_type_gating_enabled,
    courseExpiredMessage: metadata.course_expired_message,
    id: metadata.id,
    title: metadata.name,
    number: metadata.number,
    org: metadata.org,
    enrollmentStart: metadata.enrollment_start,
    enrollmentEnd: metadata.enrollment_end,
    end: metadata.end,
    start: metadata.start,
    enrollmentMode: metadata.enrollment.mode,
    isEnrolled: metadata.enrollment.is_active,
    canLoadCourseware: metadata.can_load_courseware,
    isStaff: metadata.is_staff,
    verifiedMode: camelCaseObject(metadata.verified_mode),
    tabs: camelCaseObject(metadata.tabs),
    showCalculator: metadata.show_calculator,
  };
}

export async function getCourseMetadata(courseId) {
  const url = `${getConfig().LMS_BASE_URL}/api/courseware/course/${courseId}`;
  const { data } = await getAuthenticatedHttpClient().get(url);
  return normalizeMetadata(data);
}

function normalizeBlocks(courseId, blocks) {
  const models = {
    courses: {},
    sections: {},
    sequences: {},
    units: {},
  };
  Object.values(blocks).forEach(block => {
    switch (block.type) {
      case 'course':
        models.courses[block.id] = {
          id: courseId,
          title: block.display_name,
          sectionIds: block.children || [],
        };
        break;
      case 'chapter':
        models.sections[block.id] = {
          id: block.id,
          title: block.display_name,
          sequenceIds: block.children || [],
        };
        break;

      case 'sequential':
        models.sequences[block.id] = {
          id: block.id,
          title: block.display_name,
          lmsWebUrl: block.lms_web_url,
          unitIds: block.children || [],
        };
        break;
      case 'vertical':
        models.units[block.id] = {
          id: block.id,
          title: block.display_name,
          graded: block.graded,
        };
        break;
      default:
        logError(`Unexpected course block type: ${block.type} with ID ${block.id}.  Expected block types are course, chapter, sequential, and vertical.`);
    }
  });

  // Next go through each list and use their child lists to decorate those children with a
  // reference back to their parent.
  Object.values(models.courses).forEach(course => {
    if (Array.isArray(course.sectionIds)) {
      course.sectionIds.forEach(sectionId => {
        const section = models.sections[sectionId];
        section.courseId = course.id;
      });
    }
  });

  Object.values(models.sections).forEach(section => {
    if (Array.isArray(section.sequenceIds)) {
      section.sequenceIds.forEach(sequenceId => {
        models.sequences[sequenceId].sectionId = section.id;
      });
    }
  });

  Object.values(models.sequences).forEach(sequence => {
    if (Array.isArray(sequence.unitIds)) {
      sequence.unitIds.forEach(unitId => {
        models.units[unitId].sequenceId = sequence.id;
      });
    }
  });

  return models;
}

export async function getCourseBlocks(courseId) {
  const { username } = getAuthenticatedUser();
  const url = new URL(`${getConfig().LMS_BASE_URL}/api/courses/v2/blocks/`);
  url.searchParams.append('course_id', courseId);
  url.searchParams.append('username', username);
  url.searchParams.append('depth', 3);
  url.searchParams.append('requested_fields', 'children,show_gated_sections,graded');

  const { data } = await getAuthenticatedHttpClient().get(url.href, {});
  return normalizeBlocks(courseId, data.blocks);
}

function normalizeSequenceMetadata(sequence) {
  return {
    sequence: {
      id: sequence.item_id,
      unitIds: sequence.items.map(unit => unit.id),
      bannerText: sequence.banner_text,
      title: sequence.display_name,
      gatedContent: camelCaseObject(sequence.gated_content),
      isTimeLimited: sequence.is_time_limited,
      // Position comes back from the server 1-indexed. Adjust here.
      activeUnitIndex: sequence.position ? sequence.position - 1 : 0,
      saveUnitPosition: sequence.save_position,
      showCompletion: sequence.show_completion,
    },
    units: sequence.items.map(unit => ({
      id: unit.id,
      sequenceId: sequence.item_id,
      bookmarked: unit.bookmarked,
      complete: unit.complete,
      title: unit.page_title,
      contentType: unit.type,
    })),
  };
}

export async function getSequenceMetadata(sequenceId) {
  const { data } = await getAuthenticatedHttpClient()
    .get(`${getConfig().LMS_BASE_URL}/api/courseware/sequence/${sequenceId}`, {});

  return normalizeSequenceMetadata(data);
}